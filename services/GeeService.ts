
import { SatelliteResult } from "../types";
import { SentinelService } from "./SentinelService";

export class GeeService {
  private static initialized = false;
  private static currentProjectId = '';

  private static get ee(): any {
    return (window as any).ee;
  }

  static isInitialized(): boolean {
    return this.initialized;
  }

  static async authenticateManual(token: string, projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    const ee = this.ee;
    if (!ee || !ee.data) throw new Error("GEE SDK not loaded.");

    return new Promise((resolve, reject) => {
        try {
            SentinelService.log('INFO', 'Manual Auth: Injecting Access Token...');
            ee.data.setAuthToken('manual-token', 'Bearer', token, 3600, [], undefined, false);
            ee.initialize(null, null, () => {
                this.initialized = true;
                SentinelService.log('SUCCESS', `GEE Engine Initialized. Project: ${projectId}`);
                resolve();
            }, (err: any) => reject(new Error(err)), null, projectId);
        } catch (e: any) { reject(e); }
    });
  }

  static async authenticate(clientId: string, projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    const ee = this.ee;
    if (!ee || !ee.data || !window.google?.accounts?.oauth2) {
      throw new Error("GEE SDK or Auth Lib missing.");
    }

    return new Promise((resolve, reject) => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/earthengine https://www.googleapis.com/auth/cloud-platform openid profile email',
          callback: (response: any) => {
            if (response.error) return reject(new Error(`OAuth: ${response.error}`));
            if (response.access_token) {
              ee.data.setAuthToken(clientId, 'Bearer', response.access_token, 3600, [], undefined, false);
              ee.initialize(null, null, () => {
                this.initialized = true;
                resolve();
              }, (err: any) => reject(new Error(err)), null, projectId);
            } else reject(new Error("Token extraction failed."));
          },
        });
        tokenClient.requestAccessToken();
      } catch (e: any) { reject(e); }
    });
  }

  static async generateSingleLocalUrl(
    imageId: string, 
    sensingDate: string,
    algoId: string, 
    geometry: any, 
    experimentName: string
  ): Promise<{url: string, fileName: string}> {
    if (!this.initialized) throw new Error("GEE Engine not initialized.");
    const ee = this.ee;
    
    const coords = geometry.geometry ? geometry.geometry.coordinates : geometry.coordinates;
    const roi = ee.Geometry.Polygon(coords);

    const img = ee.Image(imageId);
    let result = img.select(['B4', 'B3', 'B2']);
    
    const upAlgo = algoId.toUpperCase();
    if (upAlgo.includes('NDVI')) {
      result = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
    } else if (upAlgo.includes('NDWI')) {
      result = img.normalizedDifference(['B3', 'B8']).rename('NDWI');
    } else if (upAlgo.includes('VEG_MASK')) {
      const ndvi = img.normalizedDifference(['B8', 'B4']);
      result = ndvi.updateMask(ndvi.gt(0.4)).rename('VegMask');
    } else if (upAlgo.includes('GRAY_MODE')) {
       result = img.expression('0.299*R + 0.587*G + 0.114*B', {
         'R': img.select('B4'),
         'G': img.select('B3'),
         'B': img.select('B2')
       }).rename('Grayscale');
    }

    const shortId = imageId.split('/').pop() || 'IMG';
    const cleanDate = sensingDate.split('T')[0].replace(/-/g, '').substring(0, 8);
    const cleanExp = experimentName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const fileName = `${cleanExp}_${cleanDate}_${shortId}`;

    return new Promise((resolve, reject) => {
        result.clip(roi).getDownloadURL({
            name: fileName,
            scale: 10,
            format: 'tif'
        }, (url: string, err: any) => {
            if (err) reject(new Error(err));
            else resolve({ url, fileName });
        });
    });
  }

  static async searchSentinel2(
    geometry: any, 
    maxCloud: number, 
    minCoverage: number, 
    dateStart: string, 
    dateEnd: string, 
    logger?: (m: string) => void
  ): Promise<SatelliteResult[]> {
    if (!this.initialized) throw new Error("Engine not initialized.");
    const ee = this.ee;

    return new Promise((resolve, reject) => {
      try {
        const coords = geometry.geometry ? geometry.geometry.coordinates : geometry.coordinates;
        const roi = ee.Geometry.Polygon(coords);

        let collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(roi)
          .filterDate(dateStart, dateEnd)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', maxCloud));

        if (minCoverage > 0) {
          const maxNoData = 100 - minCoverage;
          collection = collection.filter(ee.Filter.lte('NODATA_PIXEL_PERCENTAGE', maxNoData));
        }

        collection = collection.sort('system:time_start', false);

        collection.limit(200).evaluate((list: any, error: any) => {
          if (error) {
            SentinelService.log('ERROR', `GEE Evaluate Error: ${error.message || error}`);
            return reject(new Error(error.message || error));
          }
          if (!list || !list.features) return resolve([]);

          const results = list.features.map((f: any) => {
            let bounds: number[][] = [];
            try {
                const geo = f.geometry;
                if (geo.type === 'Polygon') bounds = geo.coordinates[0].map((c: any) => [c[1], c[0]]);
                else if (geo.type === 'MultiPolygon') bounds = geo.coordinates[0][0].map((c: any) => [c[1], c[0]]);
            } catch (e) { }

            const props = f.properties;
            const actualNoData = props['NODATA_PIXEL_PERCENTAGE'] || 0;
            const actualCoverage = Math.round((100 - actualNoData) * 100) / 100;

            return {
              id: f.id,
              thumbnail: ee.Image(f.id).getThumbURL({ min: 0, max: 3000, bands: ['B4', 'B3', 'B2'], dimensions: 200, format: 'jpg' }),
              date: props['system:time_start'] ? new Date(props['system:time_start']).toISOString().split('T')[0] : 'Unknown',
              cloudCover: props['CLOUDY_PIXEL_PERCENTAGE'] ? Math.round(props['CLOUDY_PIXEL_PERCENTAGE'] * 100) / 100 : 0,
              tileId: props['MGRS_TILE'] || 'N/A',
              bounds: bounds,
              metadata: {
                platform: props['SPACECRAFT_NAME'] || 'Sentinel-2',
                dataLevel: 'Level-2A (SR)',
                resolution: '10m',
                bands: 'B4(R), B3(G), B2(B)',
                processingBaseline: props['PROCESSING_BASELINE'] || 'N/A',
                orbitNumber: props['SENSING_ORBIT_NUMBER']?.toString() || 'N/A',
                sensingTime: props['system:time_start'] ? new Date(props['system:time_start']).toISOString().replace('T', ' ').split('.')[0] : 'N/A',
                orbitDirection: props['SENSING_ORBIT_DIRECTION'] || 'DESCENDING',
                relativeOrbit: props['RELATIVE_ORBIT_NUMBER']?.toString() || 'N/A',
                dataCoverage: `${actualCoverage}%`
              }
            };
          });
          resolve(results);
        });
      } catch (e: any) { reject(new Error(`Runtime Error: ${e.message}`)); }
    });
  }

  static async startBatchExport(
    imageIds: string[], 
    algoId: string, 
    geometry: any, 
    type: string, 
    taskPrefix: string,
    onStepLog?: (msg: string) => void
  ): Promise<string[]> {
    if (!this.initialized) throw new Error("GEE Engine NOT Initialized.");
    const ee = this.ee;
    
    if (!ee.batch || !ee.batch.Export) {
        throw new Error("CRITICAL: ee.batch.Export is undefined.");
    }

    const coords = geometry.geometry ? geometry.geometry.coordinates : geometry.coordinates;
    const roi = ee.Geometry.Polygon(coords);
    const taskIds: string[] = [];
    const cleanProjectId = this.currentProjectId.replace(/^projects\//, '').split(':').pop() || this.currentProjectId;
    
    onStepLog?.(`Syncing with Project: ${cleanProjectId}`);

    for (const id of imageIds) {
        const safeId = id.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_') || 'img';
        const description = `${taskPrefix}_${safeId}`.substring(0, 80);
        
        onStepLog?.(`Building Kernel for: ${safeId}`);

        const rawImg = ee.Image(id);
        const upAlgo = algoId.toUpperCase();
        let processedImg = rawImg.select(['B4', 'B3', 'B2']);
        if (upAlgo.includes('NDVI')) processedImg = rawImg.normalizedDifference(['B8', 'B4']).rename('NDVI');
        else if (upAlgo.includes('NDWI')) processedImg = rawImg.normalizedDifference(['B3', 'B8']).rename('NDWI');
        else if (upAlgo.includes('GRAY_MODE')) {
           processedImg = rawImg.expression('0.299*R + 0.587*G + 0.114*B', {
             'R': rawImg.select('B4'),
             'G': rawImg.select('B3'),
             'B': rawImg.select('B2')
           }).rename('Grayscale');
        }

        const finalImg = processedImg.clip(roi);
        let task: any = null;

        try {
          const exportParams: any = {
            image: finalImg,
            description: description,
            scale: 10,
            region: roi,
            maxPixels: 1e13
          };

          if (type === 'DRIVE') {
            exportParams.folder = 'EarthEngine_Exports';
            exportParams.fileNamePrefix = description;
            task = ee.batch.Export.image.toDrive(exportParams);
          } else if (type === 'ASSET') {
            exportParams.assetId = `projects/${cleanProjectId}/assets/${description}`;
            task = ee.batch.Export.image.toAsset(exportParams);
          } else if (type === 'GCS') {
            exportParams.bucket = cleanProjectId; 
            exportParams.fileNamePrefix = description;
            task = ee.batch.Export.image.toCloudStorage(exportParams);
          }

          if (task) {
            onStepLog?.(`Uplinking Request...`);
            const taskId = await new Promise<string>((resolve, reject) => {
                task.start((id: string) => {
                    SentinelService.log('SUCCESS', `Task Accepted: ${description} (ID: ${id})`);
                    resolve(id || 'ACCEPTED');
                }, (err: any) => reject(new Error(err)));
            });
            onStepLog?.(`SUCCESS: Task ID [${taskId}] queued.`);
            taskIds.push(taskId);
          }
        } catch (e: any) {
          onStepLog?.(`!! UPLINK_FAULT: ${e.message || e}`);
          throw e;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    return taskIds;
  }

  static getOverlayMapId(imageId: string): Promise<string> {
    const ee = this.ee;
    return new Promise((resolve, reject) => {
      try {
        const vis = { min: 0, max: 2000, bands: ['B4', 'B3', 'B2'], gamma: 1.25 };
        ee.Image(imageId).getMapId(vis, (result: any, error: any) => {
            if (error) reject(error);
            else resolve(result.urlFormat);
        });
      } catch (e) { reject(e); }
    });
  }
}
