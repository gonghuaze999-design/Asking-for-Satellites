// MapView.tsx - 统一地图入口，根据引擎渲染对应组件，ref稳定不重建
import React, { useState, forwardRef } from 'react';
import AMapViewComponent, { GoogleMapRef } from './AMapView';
import GoogleMapViewComponent from './GoogleMapView';

interface MapViewProps {
  onGeometryChange: (geoJson: any) => void;
  showDrawingTools: boolean;
}

const MapView = forwardRef<GoogleMapRef, MapViewProps>((props, ref) => {
  // 用useState只读一次，之后固定不变，避免re-render时重建地图
  const [engine] = useState<string>(() => (window as any).__MAP_ENGINE__ || 'amap');

  if (engine === 'google') {
    return <GoogleMapViewComponent ref={ref} {...props} />;
  }
  return <AMapViewComponent ref={ref} {...props} />;
});

export default MapView;
export type { GoogleMapRef };
