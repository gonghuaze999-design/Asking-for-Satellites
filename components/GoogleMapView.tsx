
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

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
  addTileLayer: (urlTemplate: string) => void; // New Method
  clearOverlays: () => void;
}

const GoogleMapView = forwardRef<GoogleMapRef, GoogleMapViewProps>(({ onGeometryChange, showDrawingTools, center = { lat: 39.9, lng: 116.4 } }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const drawingManager = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [info, setInfo] = useState({ lat: center.lat, lng: center.lng, zoom: 12 });
  const overlays = useRef<any[]>([]);

  // Robust Clear Function
  const clearOverlays = () => {
    // 1. Clear manually drawn shapes
    try {
        if (overlays.current) {
            overlays.current.forEach(o => {
                if (o && typeof o.setMap === 'function') o.setMap(null);
            });
        }
        overlays.current = [];
    } catch (e) {
        console.warn("Error clearing drawn overlays:", e);
    }

    // 2. Clear Data Layer (GeoJSON)
    try {
        if (mapInstance.current && mapInstance.current.data) {
            const featuresToRemove: any[] = [];
            mapInstance.current.data.forEach((feature: any) => {
                featuresToRemove.push(feature);
            });
            featuresToRemove.forEach((feature: any) => {
                mapInstance.current.data.remove(feature);
            });
        }
    } catch (e) {
        console.error("Error clearing data layer:", e);
    }
    
    // 3. Clear Tile Overlays
    try {
        if (mapInstance.current && mapInstance.current.overlayMapTypes) {
            mapInstance.current.overlayMapTypes.clear();
        }
    } catch (e) {
        console.error("Error clearing tile overlays:", e);
    }
  };

  useImperativeHandle(ref, () => ({
    setCenter: (lat: number, lng: number) => mapInstance.current?.setCenter({ lat, lng }),
    fitBounds: (bounds: any) => mapInstance.current?.fitBounds(bounds),
    addGeoJson: (data: any) => {
      // Note: We do NOT clear everything here, because we might want bounds + tiles
      // But for this app flow, we usually clear old selection before new selection.
      // Let's assume the parent manages full clear if needed.
      // But actually, for single selection, we usually want to clear old feature.
      
      // Clear only GeoJSON features, keep tiles if any (though usually they go together)
      if (mapInstance.current && mapInstance.current.data) {
          mapInstance.current.data.forEach((f: any) => mapInstance.current.data.remove(f));
      }

      if (!mapInstance.current || !mapInstance.current.data || !data) return;

      try {
        mapInstance.current.data.addGeoJson(data);
        
        const bounds = new google.maps.LatLngBounds();
        let hasPoints = false;
        mapInstance.current.data.forEach((f: any) => {
          f.getGeometry().forEachLatLng((l: any) => {
            bounds.extend(l);
            hasPoints = true;
          });
        });
        if (hasPoints) mapInstance.current.fitBounds(bounds);
      } catch (e) {
        console.error("Map GeoJSON Add Error:", e);
      }
    },
    addTileLayer: (urlTemplate: string) => {
        if (!mapInstance.current) return;
        
        console.log("Adding Tile Layer to Map:", urlTemplate);

        // Remove existing overlays to show only the new one
        mapInstance.current.overlayMapTypes.clear();

        const layer = new google.maps.ImageMapType({
            getTileUrl: (coord: any, zoom: any) => {
                // Ensure the template replaces {x}, {y}, {z} correctly
                const url = urlTemplate
                    .replace('{x}', coord.x.toString())
                    .replace('{y}', coord.y.toString())
                    .replace('{z}', zoom.toString());
                return url;
            },
            tileSize: new google.maps.Size(256, 256),
            opacity: 1.0,
            name: 'Sentinel-2',
            isPng: true
        });

        mapInstance.current.overlayMapTypes.push(layer);
    },
    clearOverlays
  }));

  // Handle Drawing Tools Visibility
  useEffect(() => {
    if (drawingManager.current) {
      drawingManager.current.setOptions({
        drawingControl: showDrawingTools
      });
    }
  }, [showDrawingTools]);

  useEffect(() => {
    if (!containerRef.current || isLoaded) return;
    if (!window.google || !window.google.maps) return;
    
    const map = new google.maps.Map(containerRef.current, {
      center, 
      zoom: 11, 
      mapTypeId: 'hybrid', 
      disableDefaultUI: true,
      tilt: 0,
      styles: [{ featureType: 'all', elementType: 'labels', stylers: [{ visibility: 'on' }] }]
    });
    mapInstance.current = map;

    // Style the GeoJSON data layer
    map.data.setStyle({
      fillColor: '#11b4d4',
      fillOpacity: 0.0, // Make polygon transparent inside so we can see the tile layer
      strokeColor: '#11b4d4',
      strokeWeight: 2,
      clickable: false 
    });

    const dm = new google.maps.drawing.DrawingManager({
      drawingControl: showDrawingTools,
      drawingControlOptions: { 
        position: google.maps.ControlPosition.TOP_CENTER, 
        drawingModes: ['polygon', 'rectangle'] 
      },
      polygonOptions: { 
        fillColor: '#11b4d4', 
        fillOpacity: 0.2, 
        strokeColor: '#11b4d4', 
        strokeWeight: 2, 
        editable: true,
        zIndex: 1
      },
      rectangleOptions: {
        fillColor: '#11b4d4',
        fillOpacity: 0.2,
        strokeColor: '#11b4d4',
        strokeWeight: 2,
        editable: true,
        zIndex: 1
      }
    });
    drawingManager.current = dm;
    dm.setMap(map);

    google.maps.event.addListener(dm, 'overlaycomplete', (e: any) => {
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
        coords.push(coords[0]); 
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
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Initializing Map Engine...</span>
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
      {isLoaded && (
        <div className="absolute top-4 left-4 z-10 bg-background-dark/80 backdrop-blur-md border border-border-dark p-3 rounded-2xl flex items-center gap-4 shadow-2xl pointer-events-none">
          <div className="flex items-center gap-2 border-r border-border-dark pr-4">
            <MapPin size={14} className="text-primary" />
            <span className="text-xs font-mono font-bold tracking-tight">{info.lat.toFixed(5)}, {info.lng.toFixed(5)}</span>
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ZOOM {info.zoom}</div>
        </div>
      )}
    </div>
  );
});

export default GoogleMapView;
