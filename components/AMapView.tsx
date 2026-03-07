import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MapPin, Loader2, Pencil, Check, Trash2 } from 'lucide-react';

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

const wgs84ToGcj02 = (lng: number, lat: number) => {
  const a = 6378245.0, ee = 0.00669342162296594323;
  const tLat = (x: number, y: number) => {
    let r = -100+2*x+3*y+0.2*y*y+0.1*x*y+0.2*Math.sqrt(Math.abs(x));
    r += (20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;
    r += (20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3;
    r += (160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3;
    return r;
  };
  const tLng = (x: number, y: number) => {
    let r = 300+x+2*y+0.1*x*x+0.1*x*y+0.1*Math.sqrt(Math.abs(x));
    r += (20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;
    r += (20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3;
    r += (150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3;
    return r;
  };
  let dlat = tLat(lng-105, lat-35), dlng = tLng(lng-105, lat-35);
  const radlat = lat/180*Math.PI;
  let magic = Math.sin(radlat); magic = 1-ee*magic*magic;
  const sq = Math.sqrt(magic);
  dlat = dlat*180/((a*(1-ee))/(magic*sq)*Math.PI);
  dlng = dlng*180/(a/sq*Math.cos(radlat)*Math.PI);
  return { lng: lng+dlng, lat: lat+dlat };
};

const gcj02ToWgs84 = (lng: number, lat: number) => {
  const d = wgs84ToGcj02(lng, lat);
  return { lng: 2*lng-d.lng, lat: 2*lat-d.lat };
};

const AMapView = forwardRef<GoogleMapRef, AMapViewProps>(({ onGeometryChange, showDrawingTools, center = { lat: 39.9, lng: 116.4 } }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const tileLayers = useRef<any[]>([]);
  const geoJsonOverlays = useRef<any[]>([]);
  const drawingPolygon = useRef<any>(null);
  const drawingMarkers = useRef<any[]>([]);
  const drawingPoints = useRef<{lng:number,lat:number}[]>([]); // GCJ坐标
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [info, setInfo] = useState({ lat: center.lat, lng: center.lng, zoom: 12 });

  const clearOverlays = () => {
    tileLayers.current.forEach(l => { try { mapInstance.current?.remove(l); } catch(e){} });
    tileLayers.current = [];
    geoJsonOverlays.current.forEach(o => { try { mapInstance.current?.remove(o); } catch(e){} });
    geoJsonOverlays.current = [];
    clearDrawing();
  };

  const clearDrawing = () => {
    if (drawingPolygon.current) { try { mapInstance.current?.remove(drawingPolygon.current); } catch(e){} drawingPolygon.current = null; }
    drawingMarkers.current.forEach(m => { try { mapInstance.current?.remove(m); } catch(e){} });
    drawingMarkers.current = [];
    drawingPoints.current = [];
    setPointCount(0);
  };

  const startDrawing = () => {
    clearDrawing();
    setIsDrawing(true);
    if (mapInstance.current) mapInstance.current.setDefaultCursor('crosshair');
  };

  const finishDrawing = () => {
    if (drawingPoints.current.length < 3) return;
    setIsDrawing(false);
    if (mapInstance.current) mapInstance.current.setDefaultCursor('');
    // 转回WGS84输出
    const wgsCoords = drawingPoints.current.map(p => {
      const w = gcj02ToWgs84(p.lng, p.lat);
      return [w.lng, w.lat];
    });
    wgsCoords.push(wgsCoords[0]);
    onGeometryChange({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [wgsCoords] } });
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    if (mapInstance.current) mapInstance.current.setDefaultCursor('');
    clearDrawing();
  };

  useImperativeHandle(ref, () => ({
    setCenter: (lat, lng) => {
      const gcj = wgs84ToGcj02(lng, lat);
      mapInstance.current?.setCenter([gcj.lng, gcj.lat]);
    },
    fitBounds: (bounds: any) => {
      if (!mapInstance.current || !bounds) return;
      try {
        const sw = wgs84ToGcj02(bounds.sw.lng, bounds.sw.lat);
        const ne = wgs84ToGcj02(bounds.ne.lng, bounds.ne.lat);
        mapInstance.current.setBounds(new AMap.Bounds([sw.lng, sw.lat], [ne.lng, ne.lat]));
      } catch(e) { console.warn('fitBounds error', e); }
    },
    addGeoJson: (data: any) => {
      if (!mapInstance.current || !data) return;
      geoJsonOverlays.current.forEach(o => { try { mapInstance.current.remove(o); } catch(e){} });
      geoJsonOverlays.current = [];
      try {
        const coords = data.geometry?.coordinates?.[0];
        if (!coords) return;
        const path = coords.map((c: number[]) => {
          const g = wgs84ToGcj02(c[0], c[1]);
          return new AMap.LngLat(g.lng, g.lat);
        });
        const polygon = new AMap.Polygon({ path, fillColor: '#11b4d4', fillOpacity: 0.1, strokeColor: '#11b4d4', strokeWeight: 2 });
        mapInstance.current.add(polygon);
        mapInstance.current.setFitView([polygon]);
        geoJsonOverlays.current.push(polygon);
      } catch(e) { console.error('addGeoJson error', e); }
    },
    addTileLayer: (urlTemplate: string) => {
      if (!mapInstance.current) return;
      tileLayers.current.forEach(l => { try { mapInstance.current.remove(l); } catch(e){} });
      tileLayers.current = [];
      const proxied = urlTemplate.replace('https://earthengine.googleapis.com', '/proxy/ee');
      console.log('Adding Tile Layer:', proxied);
      const layer = new AMap.TileLayer({
        getTileUrl: function(x: number, y: number, z: number) {
          return proxied.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
        },
        zIndex: 100, opacity: 1.0, zooms: [1, 20],
      });
      mapInstance.current.add(layer);
      tileLayers.current.push(layer);
    },
    clearOverlays
  }));

  // showDrawingTools关闭时取消绘制
  useEffect(() => {
    if (!showDrawingTools) {
      setIsDrawing(false);
      if (mapInstance.current) mapInstance.current.setDefaultCursor('');
    }
  }, [showDrawingTools]);

  // 地图点击事件 — 手动收集多边形顶点
  useEffect(() => {
    if (!mapInstance.current || !isDrawing) return;
    const handler = (e: any) => {
      const pt = { lng: e.lnglat.lng, lat: e.lnglat.lat };
      drawingPoints.current.push(pt);
      setPointCount(drawingPoints.current.length);

      // 画顶点标记
      const marker = new AMap.CircleMarker({
        center: [pt.lng, pt.lat],
        radius: 4,
        fillColor: '#11b4d4',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 1,
        zIndex: 200,
      });
      mapInstance.current.add(marker);
      drawingMarkers.current.push(marker);

      // 实时更新预览多边形
      if (drawingPoints.current.length >= 2) {
        if (drawingPolygon.current) mapInstance.current.remove(drawingPolygon.current);
        const preview = new AMap.Polygon({
          path: drawingPoints.current.map(p => [p.lng, p.lat]),
          fillColor: '#11b4d4', fillOpacity: 0.15,
          strokeColor: '#11b4d4', strokeWeight: 2, strokeStyle: 'dashed',
        });
        mapInstance.current.add(preview);
        drawingPolygon.current = preview;
      }
    };
    mapInstance.current.on('click', handler);
    return () => { mapInstance.current?.off('click', handler); };
  }, [isDrawing]);

  useEffect(() => {
    const tryInit = () => {
      if (!containerRef.current || mapInstance.current) return;
      if (!(window as any).AMap) { setTimeout(tryInit, 100); return; }
      const gcjCenter = wgs84ToGcj02(center.lng, center.lat);
      const map = new AMap.Map(containerRef.current, {
        center: [gcjCenter.lng, gcjCenter.lat],
        zoom: 11,
        mapStyle: 'amap://styles/dark',
        layers: [new AMap.TileLayer.Satellite()],
      });
      mapInstance.current = map;
      map.addControl(new AMap.Scale());
      map.on('mousemove', (e: any) => {
        const w = gcj02ToWgs84(e.lnglat.lng, e.lnglat.lat);
        setInfo(prev => ({ ...prev, lat: w.lat, lng: w.lng }));
      });
      map.on('zoomchange', () => setInfo(prev => ({ ...prev, zoom: Math.round(map.getZoom()) })));
      setIsLoaded(true);
    };
    tryInit();
  }, []);

  return (
    <div className="relative w-full h-full bg-[#0a0b0e]">
      {!isLoaded && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0b0e]">
          <Loader2 size={32} className="animate-spin text-primary mb-4" />
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Initializing AMap Engine...</span>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />

      {/* 绘制工具栏 — Sketch模式下显示 */}
      {isLoaded && showDrawingTools && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          {!isDrawing ? (
            <button
              onClick={startDrawing}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-black text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:scale-105 transition-all"
            >
              <Pencil size={13} /> Draw Polygon
            </button>
          ) : (
            <>
              <div className="px-3 py-2 bg-[#0a0b0e]/90 border border-primary/50 rounded-xl text-[10px] font-mono text-primary text-center">
                {pointCount < 3 ? `Click to add points (${pointCount}/3 min)` : `${pointCount} points — finish or keep adding`}
              </div>
              <button
                onClick={finishDrawing}
                disabled={pointCount < 3}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-black text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:scale-105 transition-all disabled:opacity-30"
              >
                <Check size={13} /> Finish
              </button>
              <button
                onClick={cancelDrawing}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg hover:scale-105 transition-all"
              >
                <Trash2 size={13} /> Cancel
              </button>
            </>
          )}
        </div>
      )}

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
