// MapView.tsx - 统一地图入口，根据引擎渲染对应组件，ref稳定不重建
import React, { forwardRef } from 'react';
import AMapViewComponent, { GoogleMapRef } from './AMapView';
import GoogleMapViewComponent from './GoogleMapView';

interface MapViewProps {
  onGeometryChange: (geoJson: any) => void;
  showDrawingTools: boolean;
}

// 在模块加载时确定引擎，之后不再变化
const engine = (window as any).__MAP_ENGINE__ || 'amap';

const MapView = forwardRef<GoogleMapRef, MapViewProps>((props, ref) => {
  if (engine === 'google') {
    return <GoogleMapViewComponent ref={ref} {...props} />;
  }
  return <AMapViewComponent ref={ref} {...props} />;
});

export default MapView;
export type { GoogleMapRef };
