
/**
 * GEE Service - 深度适配 API Key 鉴权与项目 ID
 */
import { SatelliteResult } from "../types";

declare const ee: any;

export class GeeService {
  private static initialized = false;
  
  // 根据用户提供的最新信息落实：项目名称：GEE-Satellite-App
  public static readonly PROJECT_NAME = 'GEE-Satellite-App';
  // 项目 ID：gee-satellite-app-483808
  public static readonly PROJECT_ID = 'gee-satellite-app-483808';

  private static getEffectiveKey(): string {
    return window.__MANUAL_KEY__ || process.env.API_KEY || '';
  }

  static async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    return new Promise((resolve, reject) => {
      try {
        const apiKey = this.getEffectiveKey();
        
        if (!apiKey || apiKey === 'GEMINI_API_KEY') {
          return reject(new Error("未检测到 API Key。请在启动页输入具备 Earth Engine 权限的 Key。"));
        }

        console.log(`[GEE] 正在为项目 ${this.PROJECT_ID} 启动鉴权检查...`);

        // 核心检查：如果库中没有 setApiKey，尝试使用底层 setAuthToken
        if (ee.data && typeof ee.data.setApiKey === 'function') {
          ee.data.setApiKey(apiKey);
        } else if (ee.data && typeof ee.data.setAuthToken === 'function') {
          // 备选方案：将 API Key 作为 Token 注入（部分旧版库或特定环境）
          // API Key 在 GEE 后端通常可以通过特定的 token 字段传递
          ee.data.setAuthToken(null, 'Bearer', apiKey, 3600, [], null, false);
        } else {
          console.warn("[GEE] 当前版本的 GEE 库不支持 setApiKey，将尝试直接初始化...");
        }

        // 落实项目 ID 绑定
        if (ee.data && typeof ee.data.setProject === 'function') {
          ee.data.setProject(this.PROJECT_ID);
        }

        // 初始化引擎
        // 在 API Key 模式下，通常使用默认端点
        ee.initialize(
          null, 
          null,
          () => {
            this.initialized = true;
            console.log(`[GEE] 引擎就绪。项目: ${this.PROJECT_NAME} (${this.PROJECT_ID})`);
            resolve();
          },
          (err: any) => {
            console.error("[GEE] 初始化异常:", err);
            const errorStr = err.toString();
            if (errorStr.includes("401") || errorStr.includes("credential") || errorStr.includes("OAuth") || errorStr.includes("authenticated")) {
              reject(new Error(`认证失败：请确认 API Key 具备 Earth Engine 访问权限，且项目 [${this.PROJECT_ID}] 已注册及启用 API。`));
            } else {
              reject(new Error(`GEE 初始化失败: ${err}`));
            }
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  static async searchSentinel2(
    geometry: any, 
    maxCloud: number, 
    dateStart: string, 
    dateEnd: string,
    onProgress?: (msg: string) => void
  ): Promise<SatelliteResult[]> {
    await this.ensureInitialized();
    
    onProgress?.("正在同步地理围栏...");

    return new Promise((resolve, reject) => {
      try {
        let coords = geometry.geometry.coordinates;
        if (!Array.isArray(coords[0][0])) {
          coords = [coords]; 
        }

        const roi = ee.Geometry.Polygon(coords);
        onProgress?.(`正在检索数据 (项目: ${this.PROJECT_ID})...`);

        const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
          .filterBounds(roi)
          .filterDate(dateStart, dateEnd)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', maxCloud))
          .sort('CLOUDY_PIXEL_PERCENTAGE');

        onProgress?.("正在解析影像元数据...");
        
        collection.limit(12).evaluate((list: any, error: any) => {
          if (error) {
            reject(new Error(`GEE 数据服务错误: ${error.message || error}`));
            return;
          }

          if (!list || !list.features || list.features.length === 0) {
            resolve([]);
            return;
          }

          onProgress?.(`已捕获 ${list.features.length} 景高分辨率影像...`);

          const results: SatelliteResult[] = list.features.map((f: any) => {
            const props = f.properties;
            const img = ee.Image(f.id);
            const thumbUrl = img.getThumbURL({
              params: 'B4,B3,B2',
              min: 0,
              max: 3000,
              dimensions: 512,
              format: 'jpg'
            });

            let rawCoords = f.geometry.coordinates[0];
            if (Array.isArray(rawCoords[0][0])) rawCoords = rawCoords[0];

            return {
              id: f.id,
              thumbnail: thumbUrl,
              date: new Date(props['system:time_start']).toISOString().split('T')[0],
              cloudCover: parseFloat(props['CLOUDY_PIXEL_PERCENTAGE'].toFixed(2)),
              tileId: props['MGRS_TILE'] || 'N/A',
              bounds: rawCoords.map((c: any) => [c[1], c[0]]), 
              metadata: {
                platform: props['SPACECRAFT_NAME'] || 'Sentinel-2',
                fullId: props['PRODUCT_ID'],
                dataDate: new Date(props['system:time_start']).toLocaleString('zh-CN')
              }
            };
          });

          resolve(results);
        });
      } catch (e: any) {
        reject(e);
      }
    });
  }
}
