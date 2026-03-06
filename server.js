const express = require('express');
const cors = require('cors');
const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ── 初始化 EE ────────────────────────────────────────────────────────────────
const KEY_FILE = path.join(__dirname, 'service-account.json');
const key = JSON.parse(fs.readFileSync(KEY_FILE));

let eeReady = false;
ee.data.authenticateViaPrivateKey(key, () => {
  ee.initialize(null, null, () => {
    eeReady = true;
    console.log('✅ Earth Engine initialized');
  }, err => console.error('EE init error:', err));
}, err => console.error('EE auth error:', err));

const checkEE = (req, res, next) => {
  if (!eeReady) return res.status(503).json({ error: 'EE not ready yet' });
  next();
};

// ── POST /api/search ─────────────────────────────────────────────────────────
// body: { geometry, cloudCover, minCoverage, dateStart, dateEnd }
app.post('/api/search', checkEE, (req, res) => {
  const { geometry, cloudCover = 30, minCoverage = 0, dateStart, dateEnd } = req.body;
  if (!geometry || !dateStart || !dateEnd) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const roi = ee.Geometry(geometry.geometry || geometry);
    const col = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(roi)
      .filterDate(dateStart, dateEnd)
      .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE', cloudCover));

    col.size().getInfo((size, err) => {
      if (err) return res.status(500).json({ error: err.toString() });
      if (size === 0) return res.json([]);

      col.limit(50, 'CLOUDY_PIXEL_PERCENTAGE').evaluate((colInfo, err2) => {
        if (err2) return res.status(500).json({ error: err2.toString() });

        const features = colInfo.features || [];
        const results = features.map(f => {
          const props = f.properties;
          const id = props['system:index'];
          const fullId = `COPERNICUS/S2_SR_HARMONIZED/${id}`;
          const date = new Date(props['system:time_start']).toISOString().split('T')[0];
          const cloud = props['CLOUDY_PIXEL_PERCENTAGE']?.toFixed(1) || '0';

          // 计算覆盖率
          const imgGeo = f.geometry;
          let coverage = 100;

          // Extract bounds from geometry
          let bounds = [];
          try {
            const geo = f.geometry;
            if (geo && geo.type === 'Polygon') {
              bounds = geo.coordinates[0].map(c => [c[1], c[0]]);
            } else if (geo && geo.type === 'MultiPolygon') {
              bounds = geo.coordinates[0][0].map(c => [c[1], c[0]]);
            }
          } catch (e) {}

          return {
            id: fullId,
            thumbnail: `/api/thumbnail?id=${encodeURIComponent(fullId)}`,
            date,
            cloudCover: parseFloat(cloud),
            tileId: props['MGRS_TILE'] || id,
            bounds,
            metadata: {
              platform: props['SPACECRAFT_NAME'] || 'Sentinel-2',
              dataLevel: 'Level-2A (SR)',
              resolution: '10m',
              bands: 'B4(R), B3(G), B2(B)',
              processingBaseline: props['PROCESSING_BASELINE'] || 'N/A',
              orbitNumber: props['SENSING_ORBIT_NUMBER']?.toString() || 'N/A',
              sensingTime: date,
              orbitDirection: props['SENSING_ORBIT_DIRECTION'] || 'DESCENDING',
              relativeOrbit: props['RELATIVE_ORBIT_NUMBER']?.toString() || 'N/A'
            }
          };
        });

        res.json(results);
      });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/thumbnail ───────────────────────────────────────────────────────
// query: id — proxy image buffer to avoid browser CORS
app.get('/api/thumbnail', checkEE, (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const img = ee.Image(id);
    img.getThumbURL(
      { min: 0, max: 3000, bands: ['B4', 'B3', 'B2'], dimensions: 200, format: 'jpg' },
      (url, err) => {
        if (err) {
          console.error('Thumbnail URL error:', err);
          return res.status(500).json({ error: err.toString() });
        }
        if (!url) return res.status(500).json({ error: 'No URL returned' });

        // Proxy image buffer through server to avoid CORS
        const https = require('https');
        const http = require('http');
        const client = url.startsWith('https') ? https : http;

        const request = client.get(url, (imgRes) => {
          if (imgRes.statusCode !== 200) {
            // Fallback: redirect directly
            return res.redirect(url);
          }
          res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          imgRes.pipe(res);
        });
        request.on('error', () => {
          // If proxy fails, redirect as fallback
          res.redirect(url);
        });
        request.setTimeout(10000, () => {
          request.destroy();
          res.redirect(url);
        });
      }
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/tile ────────────────────────────────────────────────────────────
// query: id — 返回瓦片 URL 模板
app.get('/api/tile', checkEE, (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const vis = { min: 0, max: 2000, bands: ['B4', 'B3', 'B2'], gamma: 1.25 };
    ee.Image(id).getMapId(vis, (mapId, err) => {
      if (err) return res.status(500).json({ error: err.toString() });
      res.json({ tileUrl: mapId.urlFormat });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/download ───────────────────────────────────────────────────────
// body: { id, geometry, algoId, experimentName, sensingDate }
// returns: { url, fileName }
app.post('/api/download', checkEE, (req, res) => {
  const { id, geometry, algoId = 'RGB', experimentName = 'EXPORT', sensingDate = '' } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    let img = ee.Image(id);

    // Apply band selection based on algoId
    if (algoId === 'NDVI') {
      img = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
    } else if (algoId === 'NDWI') {
      img = img.normalizedDifference(['B3', 'B8']).rename('NDWI');
    } else {
      img = img.select(['B4', 'B3', 'B2']);
    }

    const roi = geometry ? ee.Geometry(geometry.geometry || geometry) : null;
    const params = {
      name: `${experimentName}_${sensingDate || 'export'}`,
      scale: 10,
      filePerBand: false,
      fileFormat: 'GeoTIFF',
      ...(roi ? { region: roi } : {})
    };

    img.getDownloadURL(params, (url, err) => {
      if (err) return res.status(500).json({ error: err.toString() });
      const fileName = `${experimentName}_${(sensingDate || id.split('/').pop() || 'export').substring(0, 20)}`;
      res.json({ url, fileName });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/export ─────────────────────────────────────────────────────────
// body: { id, geometry, projectId, description }
app.post('/api/export', checkEE, (req, res) => {
  const { id, geometry, projectId, description = 'export' } = req.body;
  if (!id || !projectId) return res.status(400).json({ error: 'Missing id or projectId' });

  try {
    const img = ee.Image(id);
    const roi = geometry ? ee.Geometry(geometry.geometry || geometry) : null;
    const task = ee.batch.Export.image.toDrive({
      image: img.select(['B4', 'B3', 'B2', 'B8']),
      description,
      folder: 'GEE_Exports',
      scale: 10,
      region: roi || img.geometry(),
      maxPixels: 1e9,
      fileFormat: 'GeoTIFF'
    });
    task.start();
    task.id((taskId, err) => {
      if (err) return res.status(500).json({ error: err.toString() });
      res.json({ taskId, status: 'STARTED' });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/task/:taskId ────────────────────────────────────────────────────
app.get('/api/task/:taskId', checkEE, (req, res) => {
  ee.data.getTaskStatus([req.params.taskId], (status, err) => {
    if (err) return res.status(500).json({ error: err.toString() });
    res.json(status[0] || {});
  });
});

// ── 健康检查 ─────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: eeReady ? 'ready' : 'initializing' });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 GEE Backend running on port ${PORT}`));
