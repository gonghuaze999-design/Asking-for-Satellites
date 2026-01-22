
import { SatelliteResult } from "../types";
import { SentinelService } from "./SentinelService";

export class GeeService {
  private static initialized = false;
  private static currentProjectId = '';

  private static get ee(): any {
    return (window as any).ee;
  }

  // --- MANUAL AUTH MODE (Bypass OAuth) ---
  static async authenticateManual(token: string, projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    const ee = this.ee;
    
    if (!ee || !ee.data) throw new Error("GEE SDK not loaded.");

    return new Promise((resolve, reject) => {
        try {
            SentinelService.log('INFO', 'Attempting Manual Token Injection...');
            
            // Validate token format roughly
            if (token.length < 10) throw new Error("Token looks too short to be valid.");

            // Inject manually. We pass a dummy client ID because we have a bearer token.
            // The SDK requires a clientID arg but relies on the token for actual auth.
            ee.data.setAuthToken(
                'manual-token-client-id', 
                'Bearer', 
                token, 
                3600, // 1 hour expiry assumption
                [], 
                undefined, 
                false
            );

            ee.initialize(
                null, 
                null, 
                () => {
                    this.initialized = true;
                    SentinelService.log('SUCCESS', `GEE Initialized via Manual Token. Project: ${projectId}`);
                    resolve();
                }, 
                (err: any) => {
                    reject(new Error(`Manual Init Failed: ${err?.message || err}`));
                }, 
                null, 
                projectId
            );
        } catch (e: any) {
            reject(e);
        }
    });
  }

  // --- STANDARD OAUTH MODE ---
  static async authenticate(clientId: string, projectId: string): Promise<void> {
    this.currentProjectId = projectId;
    const ee = this.ee;
    
    // 1. Dependency Check
    if (!ee || !ee.data) {
      const msg = "GEE SDK Library not found (window.ee).";
      SentinelService.log('ERROR', msg);
      throw new Error(msg);
    }

    if (!window.google?.accounts?.oauth2) {
      const msg = "Google Identity Services not loaded (window.google.accounts).";
      SentinelService.log('ERROR', msg);
      throw new Error(msg);
    }

    // 2. Manual OAuth 2.0 Flow (Bypassing ee.data.authenticateViaPopup)
    return new Promise((resolve, reject) => {
      try {
        SentinelService.log('INFO', 'Initializing Direct OAuth Flow...');
        
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          // Added 'openid profile email' to reduce "Invalid Request" errors related to unverified apps
          scope: 'https://www.googleapis.com/auth/earthengine openid profile email',
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(`OAuth Error: ${response.error}`));
              return;
            }

            if (response.access_token) {
              SentinelService.log('INFO', 'Access Token Received. Injecting into GEE...');
              
              if (ee.data.setClientId) ee.data.setClientId(clientId);
              
              ee.data.setAuthToken(
                clientId, 
                'Bearer', 
                response.access_token, 
                3600, 
                [], 
                undefined, 
                false
              );

              // 4. Initialize Earth Engine with Project ID
              ee.initialize(
                null, 
                null, 
                () => {
                  this.initialized = true;
                  SentinelService.log('SUCCESS', `GEE Engine Initialized. Project: ${projectId}`);
                  resolve();
                }, 
                (err: any) => {
                   const errMsg = `GEE Init Failed: ${err?.message || err}`;
                   SentinelService.log('ERROR', errMsg);
                   reject(new Error(errMsg));
                }, 
                null, 
                projectId
              );
            } else {
              reject(new Error("Google returned no access token."));
            }
          },
        });

        // 5. Trigger the Popup
        tokenClient.requestAccessToken();

      } catch (e: any) {
        reject(new Error(`Auth Setup Failed: ${e.message}`));
      }
    });
  }

  static async searchSentinel2(geometry: any, maxCloud: number, dateStart: string, dateEnd: string, logger?: (m: string) => void): Promise<SatelliteResult[]> {
    if (!this.initialized) {
      throw new Error("Engine not initialized. Please refresh and log in.");
    }

    const ee = this.ee;
    if (logger) logger("Sending request to Google Earth Engine...");

    return new Promise((resolve, reject) => {
      try {
        // Construct Geometry
        let roi;
        try {
            // Handle FeatureCollection or Feature or Geometry inputs
            const coords = geometry.geometry ? geometry.geometry.coordinates : geometry.coordinates;
            roi = ee.Geometry.Polygon(coords);
        } catch (e) {
            console.error("Geometry Parse Error", e);
            throw new Error("Invalid ROI Geometry");
        }

        // Build Collection
        const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(roi)
          .filterDate(dateStart, dateEnd)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', maxCloud))
          .sort('CLOUDY_PIXEL_PERCENTAGE', false); // Low cloud first

        // Execute Search (evaluate)
        // Only fetch 15 items to prevent payload issues
        collection.limit(15).evaluate((list: any, error: any) => {
          if (error) {
            console.error("GEE Eval Error:", error);
            // Translate common GEE errors
            let cleanError = error.message;
            if (cleanError.includes("project not found")) cleanError = "Cloud Project ID incorrect or API disabled.";
            if (cleanError.includes("permission denied")) cleanError = "Permission denied. Check GCP IAM roles.";
            return reject(new Error(cleanError));
          }

          if (!list || !list.features) {
            return resolve([]);
          }

          if (logger) logger(`Processing ${list.features.length} features...`);

          const results = list.features.map((f: any) => {
            // Safe bounds extraction to prevent map crash
            let bounds: number[][] = [];
            try {
                // GeoJSON from GEE is usually [lng, lat]. 
                // We need to return [lat, lng] for internal logic if that's what's expected, 
                // BUT MapView expects GeoJSON which is [lng, lat]. 
                // Let's standardize: GeeService returns raw GeoJSON coordinates for the boundary.
                
                const geo = f.geometry;
                if (geo.type === 'Polygon') {
                   // f.geometry.coordinates is [[[lng, lat], ...]]
                   // We convert to [lat, lng] for the thumbnail/list logic if needed, 
                   // but usually we want to keep it simple.
                   // Let's store [lat, lng] for the UI bounds.
                   bounds = geo.coordinates[0].map((c: any) => [c[1], c[0]]);
                } else if (geo.type === 'MultiPolygon') {
                   // Just take the first polygon for the thumbnail bounds
                   bounds = geo.coordinates[0][0].map((c: any) => [c[1], c[0]]);
                }
            } catch (e) {
                console.warn("Bounds extraction failed for", f.id);
            }

            // Generate Thumbnail
            let thumb = '';
            try {
                // This call is sync in JS client but generates a URL that hits Google
                thumb = ee.Image(f.id).getThumbURL({
                    min: 0,
                    max: 3000,
                    bands: ['B4', 'B3', 'B2'],
                    dimensions: 200, // Small thumbnail
                    format: 'jpg'
                });
            } catch (e) {
                console.warn("Thumb gen failed", e);
            }

            return {
              id: f.id,
              thumbnail: thumb,
              date: f.properties['system:time_start'] ? new Date(f.properties['system:time_start']).toISOString().split('T')[0] : 'Unknown',
              cloudCover: f.properties['CLOUDY_PIXEL_PERCENTAGE'] ? Math.round(f.properties['CLOUDY_PIXEL_PERCENTAGE'] * 100) / 100 : 0,
              tileId: f.properties['MGRS_TILE'] || 'N/A',
              bounds: bounds // [lat, lng] arrays
            };
          });

          resolve(results);
        });
      } catch (e: any) {
        reject(new Error(`Runtime Error: ${e.message}`));
      }
    });
  }
}
