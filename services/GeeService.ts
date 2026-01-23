
import { SatelliteResult } from "../types";
import { SentinelService } from "./SentinelService";

export class GeeService {
  private static initialized = false;
  private static currentProjectId = '';

  private static get ee(): any {
    return (window as any).ee;
  }

  static async authenticateManual(token: string, projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    const ee = this.ee;
    if (!ee || !ee.data) throw new Error("GEE SDK not loaded.");

    return new Promise((resolve, reject) => {
        try {
            SentinelService.log('INFO', 'Attempting Manual Token Injection...');
            if (token.length < 10) throw new Error("Token looks too short to be valid.");
            ee.data.setAuthToken('manual-token-client-id', 'Bearer', token, 3600, [], undefined, false);
            ee.initialize(null, null, () => {
                this.initialized = true;
                SentinelService.log('SUCCESS', `GEE Initialized via Manual Token. Project: ${projectId}`);
                resolve();
            }, (err: any) => reject(new Error(`Manual Init Failed: ${err?.message || err}`)), null, projectId);
        } catch (e: any) { reject(e); }
    });
  }

  static async authenticate(clientId: string, projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    const ee = this.ee;
    if (!ee || !ee.data || !window.google?.accounts?.oauth2) {
      throw new Error("GEE SDK or Auth Lib not found.");
    }

    return new Promise((resolve, reject) => {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/earthengine openid profile email',
          callback: (response: any) => {
            if (response.error) return reject(new Error(`OAuth Error: ${response.error}`));
            if (response.access_token) {
              if (ee.data.setClientId) ee.data.setClientId(clientId);
              ee.data.setAuthToken(clientId, 'Bearer', response.access_token, 3600, [], undefined, false);
              ee.initialize(null, null, () => {
                this.initialized = true;
                resolve();
              }, (err: any) => reject(new Error(`GEE Init Failed: ${err?.message || err}`)), null, projectId);
            } else reject(new Error("No access token."));
          },
        });
        tokenClient.requestAccessToken();
      } catch (e: any) { reject(new Error(`Auth Setup Failed: ${e.message}`)); }
    });
  }

  static async searchSentinel2(geometry: any, maxCloud: number, dateStart: string, dateEnd: string, logger?: (m: string) => void): Promise<SatelliteResult[]> {
    if (!this.initialized) throw new Error("Engine not initialized.");
    const ee = this.ee;

    return new Promise((resolve, reject) => {
      try {
        const coords = geometry.geometry ? geometry.geometry.coordinates : geometry.coordinates;
        const roi = ee.Geometry.Polygon(coords);

        // Standard S2 SR Collection (Surface Reflectance)
        const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(roi)
          .filterDate(dateStart, dateEnd)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', maxCloud))
          .sort('system:time_start', false); // Newest first

        // Limit increased to 200 as requested
        collection.limit(200).evaluate((list: any, error: any) => {
          if (error) return reject(new Error(error.message));
          if (!list || !list.features) return resolve([]);

          const results = list.features.map((f: any) => {
            let bounds: number[][] = [];
            try {
                const geo = f.geometry;
                if (geo.type === 'Polygon') bounds = geo.coordinates[0].map((c: any) => [c[1], c[0]]);
                else if (geo.type === 'MultiPolygon') bounds = geo.coordinates[0][0].map((c: any) => [c[1], c[0]]);
            } catch (e) { console.warn("Bounds extraction failed", f.id); }

            const props = f.properties;
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
                resolution: '10m / 20m / 60m',
                bands: 'B4(R), B3(G), B2(B)',
                processingBaseline: props['PROCESSING_BASELINE'] || 'N/A',
                orbitNumber: props['SENSING_ORBIT_NUMBER']?.toString() || 'N/A',
                sensingTime: props['system:time_start'] ? new Date(props['system:time_start']).toISOString().replace('T', ' ').split('.')[0] : 'N/A',
                orbitDirection: props['SENSING_ORBIT_DIRECTION'] || 'DESCENDING',
                relativeOrbit: props['RELATIVE_ORBIT_NUMBER']?.toString() || 'N/A'
              }
            };
          });
          resolve(results);
        });
      } catch (e: any) { reject(new Error(`Runtime Error: ${e.message}`)); }
    });
  }

  static getOverlayMapId(imageId: string): Promise<string> {
    const ee = this.ee;
    return new Promise((resolve, reject) => {
      try {
        const image = ee.Image(imageId);
        // RGB Visual Parameters with slightly enhanced contrast for target detection
        const vis = { 
            min: 0, 
            max: 2000, 
            bands: ['B4', 'B3', 'B2'], 
            gamma: 1.25 
        };
        image.getMapId(vis, (result: any, error: any) => {
            if (error) reject(error);
            else resolve(result.urlFormat);
        });
      } catch (e) { reject(e); }
    });
  }
}
