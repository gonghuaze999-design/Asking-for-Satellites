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

// ── POST /api/report ─────────────────────────────────────────────────────────
// 后端代理 Gemini 报告生成，key 存在环境变量 GEMINI_API_KEY
app.post('/api/report', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set on server. Run: export GEMINI_API_KEY=your_key' });

  const { context } = req.body;
  if (!context) return res.status(400).json({ error: 'Missing context' });

  const prompt = `你是一位顶尖的农业遥感专家与全球粮食安全顾问。请基于以下遥感流水线分析结果，生成一份深度专业的中文农情监测报告。

监测背景：
- 工作流名称：${context.workflow}
- 时间区间：${context.dates.start} 至 ${context.dates.end}
- 瓦片区域 (MGRS)：${context.tiles}
- 观测趋势 (NDVI 众数动态)：${context.stats.join('; ')}

核心要求：
1. 分析该区域在监测时段内的植被变化趋势，结合季节规律解释 NDVI 波动原因。
2. 评估农业生产风险，包括干旱、病虫害、收割周期等可能影响因素。
3. 给出未来 1-3 个月的农情预测与建议。

报告结构（HTML格式）：
- 执行摘要
- 区域农业概况  
- 遥感监测分析
- 风险评估与展望

返回格式：纯 HTML 内容，包含内联 CSS，适合直接打印。`;

  try {
    const https = require('https');
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };

    const request = https.request(options, (geminiRes) => {
      let data = '';
      geminiRes.on('data', chunk => data += chunk);
      geminiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return res.status(500).json({ error: parsed.error.message });
          const report = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '报告生成失败';
          res.json({ report, groundingLinks: [] });
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse Gemini response' });
        }
      });
    });

    request.on('error', (e) => res.status(500).json({ error: e.message }));
    request.setTimeout(60000, () => { request.destroy(); res.status(504).json({ error: 'Gemini request timeout' }); });
    request.write(payload);
    request.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 健康检查 ─────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: eeReady ? 'ready' : 'initializing' });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 GEE Backend running on port ${PORT}`));
