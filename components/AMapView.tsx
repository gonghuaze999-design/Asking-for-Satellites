import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

declare const AMap: any;

const AMAP_KEY = 'f1bbf790b7f90cf469576e1c91782769';

interface AMapViewProps {
  onGeometryChange: (geoJson: any) => void;
  center?: { lat: number; lng: number };
  showDrawingTools: boolean;
}

export interface GoogleMapRef {
  setCenter: (lat: number, lng: number) => void;
  fitBounds: (bounds: any) => void;
  addGeoJson: (data: any) => void;
  addTileLayer: (urlTemplate: string) => void;
  clearOverlays: () => void;
}

// 高德坐标系(GCJ-02)与WGS84互转
const wgs84ToGcj02 = (lng: number, lat: number) => {
  const a = 6378245.0, ee = 0.00669342162296594323;
  let dlat = transformLat(lng - 105.0, lat - 35.0);
  let dlng = transformLng(lng - 105.0, lat - 35.0);
  const radlat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radlat);
  magic = 1 - ee * magic * magic;
  const sqrtmagic = Math.sqrt(magic);
  dlat = (dlat * 180.0) / ((a * (1 - ee)) / (magic * sqrtmagic) * Math.PI);
  dlng = (dlng * 180.0) / (a / sqrtmagic * Math.cos(radlat) * Math.PI);
  return { lng: lng + dlng, lat: lat + dlat };
};
const gcj02ToWgs84 = (lng: number, lat: number) => {
  const d = wgs84ToGcj02(lng, lat);
  return { lng: 2 * lng - d.lng, lat: 2 * lat - d.lat };
};
const transformLat = (x: number, y: number) => {
  let ret = -100.0 + 2.0*x + 3.0*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
  ret += (20.0*Math.sin(6.0*x*Math.PI) + 20.0*Math.sin(2.0*x*Math.PI)) * 2.0 / 3.0;
  ret += (20.0*Math.sin(y*Math.PI) + 40.0*Math.sin(y/3.0*Math.PI)) * 2.0 / 3.0;
  ret += (160.0*Math.sin(y/12.0*Math.PI) + 320*Math.sin(y*Math.PI/30.0)) * 2.0 / 3.0;
  return ret;
};
const transformLng = (x: number, y: number) => {
  let ret = 300.0 + x + 2.0*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
  ret += (20.0*Math.sin(6.0*x*Math.PI) + 20.0*Math.sin(2.0*x*Math.PI)) * 2.0 / 3.0;
  ret += (20.0*Math.sin(x*Math.PI) + 40.0*Math.sin(x/3.0*Math.PI)) * 2.0 / 3.0;
  ret += (150.0*Math.sin(x/12.0*Math.PI) + 300.0*Math.sin(x/30.0*Math.PI)) * 2.0 / 3.0;
  return ret;
};

const AMapView = forwardRef<GoogleMapRef, AMapViewProps>(({ onGeometryChange, showDrawingTools, center = { lat: 39.9, lng: 116.4 } }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const mouseTool = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  const tileLayers = useRef<any[]>([]);
  const geoJsonOverlays = useRef<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [info, setInfo] = useState({ lat: center.lat, lng: center.lng, zoom: 12 });

  const clearOverlays = () => {
    overlays.current.forEach(o => { try { mapInstance.current?.remove(o); } catch(e){} });
    overlays.current = [];
    tileLayers.current.forEach(l => { try { mapInstance.current?.remove(l); } catch(e){} });
    tileLayers.current = [];
    geoJsonOverlays.current.forEach(o => { try { mapInstance.current?.remove(o); } catch(e){} });
    geoJsonOverlays.current = [];
  };

  useImperativeHandle(ref, () => ({
    setCenter: (lat, lng) => {
      const gcj = wgs84ToGcj02(lng, lat);
      mapInstance.current?.setCenter([gcj.lng, gcj.lat]);
    },
    fitBounds: (bounds: any) => {
      if (!mapInstance.current || !bounds) return;
      try {
        // bounds 是从我们内置坐标库来的 {sw, ne}，已是WGS84
        const sw = wgs84ToGcj02(bounds.sw?.lng ?? bounds.getSouthWest?.()?.lng?.() ?? 0, bounds.sw?.lat ?? bounds.getSouthWest?.()?.lat?.() ?? 0);
        const ne = wgs84ToGcj02(bounds.ne?.lng ?? bounds.getNorthEast?.()?.lng?.() ?? 0, bounds.ne?.lat ?? bounds.getNorthEast?.()?.lat?.() ?? 0);
        const amapBounds = new AMap.Bounds([sw.lng, sw.lat], [ne.lng, ne.lat]);
        mapInstance.current.setBounds(amapBounds, false, [20, 20, 20, 20]);
      } catch(e) { console.warn('fitBounds error', e); }
    },
    addGeoJson: (data: any) => {
      if (!mapInstance.current || !data) return;
      geoJsonOverlays.current.forEach(o => mapInstance.current.remove(o));
      geoJsonOverlays.current = [];
      try {
        const coords = data.geometry?.coordinates?.[0];
        if (!coords) return;
        const gcjCoords = coords.map((c: number[]) => {
          const g = wgs84ToGcj02(c[0], c[1]);
          return [g.lng, g.lat];
        });
        const polygon = new AMap.Polygon({
          path: gcjCoords,
          fillColor: '#11b4d4', fillOpacity: 0.1,
          strokeColor: '#11b4d4', strokeWeight: 2
        });
        mapInstance.current.add(polygon);
        mapInstance.current.setFitView([polygon]);
        geoJsonOverlays.current.push(polygon);
      } catch(e) { console.error('addGeoJson error', e); }
    },
    addTileLayer: (urlTemplate: string) => {
      if (!mapInstance.current) return;
      tileLayers.current.forEach(l => mapInstance.current.remove(l));
      tileLayers.current = [];
      console.log('Adding Tile Layer to Map:', urlTemplate);
      const layer = new AMap.TileLayer({
        getTileUrl: (x: number, y: number, z: number) =>
          urlTemplate.replace('{x}', String(x)).replace('{y}', String(y)).replace('{z}', String(z)),
        zIndex: 10, opacity: 1
      });
      mapInstance.current.add(layer);
      tileLayers.current.push(layer);
    },
    clearOverlays
  }));

  useEffect(() => {
    const loadAMap = () => new Promise<void>((resolve, reject) => {
      if ((window as any).AMap) return resolve();
      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.MouseTool,AMap.Scale,AMap.ToolBar`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('AMap load failed'));
      document.head.appendChild(script);
    });

    loadAMap().then(() => {
      if (!containerRef.current || mapInstance.current) return;
      const gcjCenter = wgs84ToGcj02(center.lng, center.lat);
      const map = new AMap.Map(containerRef.current, {
        center: [gcjCenter.lng, gcjCenter.lat],
        zoom: 11,
        mapStyle: 'amap://styles/dark',
        layers: [new AMap.TileLayer.Satellite()],
      });
      mapInstance.current = map;

      map.addControl(new AMap.Scale());
      map.addControl(new AMap.ToolBar({ position: 'RT' }));

      map.on('mousemove', (e: any) => {
        const wgs = gcj02ToWgs84(e.lnglat.lng, e.lnglat.lat);
        setInfo(prev => ({ ...prev, lat: wgs.lat, lng: wgs.lng }));
      });
      map.on('zoomchange', () => setInfo(prev => ({ ...prev, zoom: Math.round(map.getZoom()) })));

      // 初始化MouseTool，不管showDrawingTools状态，统一在useEffect里控制
      const mt = new AMap.MouseTool(map);
      mouseTool.current = mt;
      mt.on('draw', (e: any) => {
        // 画完后立即关闭tool，保留图形显示
        mt.close(false);
        overlays.current.forEach(o => map.remove(o));
        overlays.current = [e.obj];
        const path = e.obj.getPath();
        const wgsCoords = path.map((p: any) => {
          const w = gcj02ToWgs84(p.lng, p.lat);
          return [w.lng, w.lat];
        });
        wgsCoords.push(wgsCoords[0]);
        onGeometryChange({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [wgsCoords] } });
      });
      setIsLoaded(true);
    }).catch(e => console.error('AMap init error', e));
  }, []);

  useEffect(() => {
    if (!mouseTool.current) return;
    if (showDrawingTools) {
      // 开启多边形绘制模式
      mouseTool.current.polygon({ 
        fillColor: '#11b4d4', fillOpacity: 0.15, 
        strokeColor: '#11b4d4', strokeWeight: 2,
        strokeStyle: 'dashed'
      });
    } else {
      // 关闭绘制，保留已画图形
      mouseTool.current.close(false);
    }
  }, [showDrawingTools, isLoaded]);

  return (
    <div className="relative w-full h-full bg-[#0a0b0e]">
      {!isLoaded && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0b0e]">
          <Loader2 size={32} className="animate-spin text-primary mb-4" />
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Initializing AMap Engine...</span>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
      {isLoaded && (
        <div className="absolute top-4 left-4 z-10 bg-[#0a0b0e]/80 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex items-center gap-4 shadow-2xl pointer-events-none">
          <div className="flex items-center gap-2 border-r border-white/10 pr-4">
            <MapPin size={14} className="text-primary" />
            <span className="text-xs font-mono font-bold tracking-tight">{info.lat.toFixed(5)}, {info.lng.toFixed(5)}</span>
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ZOOM {info.zoom}</div>
        </div>
      )}
    </div>
  );
});

export default AMapView;
