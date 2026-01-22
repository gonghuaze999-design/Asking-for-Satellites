
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MapPin, Maximize2, Loader2, Trash2, Layers, MousePointer2 } from 'lucide-react';

declare const google: any;

interface GoogleMapViewProps {
  onGeometryChange: (geoJson: any) => void;
  center?: { lat: number; lng: number };
  showDrawingTools: boolean;
}

export interface GoogleMapRef {
  setCenter: (lat: number, lng: number) => void;
  fitBounds: (bounds: any) => void;
  addGeoJson: (data: any) => void;
  clearOverlays: () => void;
}

const GoogleMapView = forwardRef<GoogleMapRef, GoogleMapViewProps>(({ onGeometryChange, showDrawingTools, center = { lat: 39.9, lng: 116.4 } }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const drawingManager = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [info, setInfo] = useState({ lat: center.lat, lng: center.lng, zoom: 12 });
  const overlays = useRef<any[]>([]);

  // Fix: Move clearOverlays logic to a stable function to avoid 'this' context issues in useImperativeHandle
  const clearOverlays = () => {
    overlays.current.forEach(o => o.setMap(null));
    overlays.current = [];
    if (mapInstance.current && mapInstance.current.data) {
      mapInstance.current.data.forEach((feature: any) => {
        // Fix: Added null check to avoid 'Object is possibly undefined'
        if (mapInstance.current && mapInstance.current.data) {
          mapInstance.current.data.remove(feature);
        }
      });
    }
  };

  useImperativeHandle(ref, () => ({
    setCenter: (lat: number, lng: number) => mapInstance.current?.setCenter({ lat, lng }),
    fitBounds: (bounds: any) => mapInstance.current?.fitBounds(bounds),
    addGeoJson: (data: any) => {
      // Fix: Use local clearOverlays instead of 'this.clearOverlays' (line 32)
      clearOverlays();
      // Fix: Explicitly check mapInstance and its data property to resolve 'Object is possibly undefined'
      if (mapInstance.current && mapInstance.current.data) {
        mapInstance.current.data.addGeoJson(data);
        const bounds = new google.maps.LatLngBounds();
        mapInstance.current.data.forEach((f: any) => f.getGeometry().forEachLatLng((l: any) => bounds.extend(l)));
        mapInstance.current.fitBounds(bounds);
      }
    },
    clearOverlays
  }));

  // 监听绘图工具的可见性切换
  useEffect(() => {
    if (drawingManager.current) {
      drawingManager.current.setOptions({
        drawingControl: showDrawingTools
      });
      // 如果关闭工具，同时清空当前地图上的临时覆盖物
      if (!showDrawingTools) {
        overlays.current.forEach(o => o.setMap(null));
        overlays.current = [];
      }
    }
  }, [showDrawingTools]);

  useEffect(() => {
    if (!containerRef.current || isLoaded) return;
    
    const map = new google.maps.Map(containerRef.current, {
      center, 
      zoom: 11, 
      mapTypeId: 'hybrid', 
      disableDefaultUI: true,
      tilt: 0,
      styles: [{ featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'on' }] }]
    });
    mapInstance.current = map;

    const dm = new google.maps.drawing.DrawingManager({
      drawingControl: showDrawingTools,
      drawingControlOptions: { 
        position: google.maps.ControlPosition.TOP_CENTER, 
        drawingModes: ['polygon', 'rectangle'] 
      },
      polygonOptions: { 
        fillColor: '#11b4d4', 
        fillOpacity: 0.15, 
        strokeColor: '#11b4d4', 
        strokeWeight: 2, 
        editable: true,
        zIndex: 1
      },
      rectangleOptions: {
        fillColor: '#11b4d4',
        fillOpacity: 0.15,
        strokeColor: '#11b4d4',
        strokeWeight: 2,
        editable: true,
        zIndex: 1
      }
    });
    drawingManager.current = dm;
    dm.setMap(map);

    google.maps.event.addListener(dm, 'overlaycomplete', (e: any) => {
      // 保持单选：清除之前的绘图
      overlays.current.forEach(o => o.setMap(null));
      overlays.current = [e.overlay];
      
      let geoJson: any = null;
      if (e.type === 'rectangle') {
        const b = e.overlay.getBounds();
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        geoJson = { 
          type: "Feature", 
          geometry: { 
            type: "Polygon", 
            coordinates: [[[sw.lng(), sw.lat()], [ne.lng(), sw.lat()], [ne.lng(), ne.lat()], [sw.lng(), ne.lat()], [sw.lng(), sw.lat()]]] 
          } 
        };
      } else {
        const path = e.overlay.getPath();
        const coords = [];
        for (let i = 0; i < path.getLength(); i++) {
          coords.push([path.getAt(i).lng(), path.getAt(i).lat()]);
        }
        coords.push(coords[0]); // 闭合环
        geoJson = { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] } };
      }
      onGeometryChange(geoJson);
    });

    map.addListener('mousemove', (e: any) => {
      if (e.latLng) setInfo(prev => ({ ...prev, lat: e.latLng.lat(), lng: e.latLng.lng() }));
    });
    map.addListener('zoom_changed', () => setInfo(prev => ({ ...prev, zoom: map.getZoom() })));
    
    setIsLoaded(true);
  }, []);

  return (
    <div className="relative w-full h-full bg-[#0a0b0e]">
      {!isLoaded && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background-dark">
          <Loader2 size={32} className="animate-spin text-primary mb-4" />
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Waking Up Satellite Engine...</span>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
      {isLoaded && (
        <>
          <div className="absolute top-4 left-4 z-10 bg-background-dark/80 backdrop-blur-md border border-border-dark p-3 rounded-2xl flex items-center gap-4 shadow-2xl">
            <div className="flex items-center gap-2 border-r border-border-dark pr-4">
              <MapPin size={14} className="text-primary" />
              <span className="text-xs font-mono font-bold tracking-tight">{info.lat.toFixed(5)}, {info.lng.toFixed(5)}</span>
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ZOOM {info.zoom}</div>
          </div>
          
          <div className="absolute right-4 top-16 z-10 flex flex-col gap-2">
            <button className="bg-background-dark/80 backdrop-blur-md border border-border-dark p-3 rounded-xl hover:text-primary transition-all shadow-2xl">
              <Layers size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
});

export default GoogleMapView;
