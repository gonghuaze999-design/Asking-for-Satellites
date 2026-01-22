
import React from 'react';

interface MapMockProps {
  activeTile?: string | null;
}

const MapMock: React.FC<MapMockProps> = ({ activeTile }) => {
  return (
    <div className="absolute inset-0 bg-[#0a0b0e] overflow-hidden">
      {/* Background Satellite Placeholder */}
      <div 
        className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 ${activeTile ? 'opacity-80 scale-100 blur-[1px]' : 'opacity-40 scale-110 blur-0'}`}
        style={{ backgroundImage: `url('https://picsum.photos/seed/${activeTile || 'chengdu'}/1920/1080')` }}
      />
      
      {/* Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ backgroundImage: 'radial-gradient(circle, #11b4d4 1px, transparent 1px)', backgroundSize: '60px 60px' }}
      />

      {/* Main Selection Footprint */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`transition-all duration-700 border-2 relative ${activeTile ? 'w-[450px] h-[450px] border-primary shadow-[0_0_50px_rgba(17,180,212,0.3)] bg-primary/5' : 'w-[300px] h-[300px] border-white/20'}`}>
          <div className="absolute top-0 right-0 p-1 bg-primary text-[8px] font-black text-background-dark uppercase px-2">
            {activeTile || 'UNSELECTED'}
          </div>
          
          {/* Corner Markers */}
          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-primary/50" />
          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-primary/50" />
          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-primary/50" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-primary/50" />
          
          {/* Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <div className="w-10 h-px bg-primary/40" />
            <div className="h-10 w-px bg-primary/40 absolute" />
          </div>
        </div>
      </div>

      {/* Dynamic Data Overlays */}
      <div className="absolute bottom-8 left-8 flex flex-col gap-1 pointer-events-none">
        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Live Metadata Feed</p>
        <p className="text-xs font-mono text-slate-500">RES: 10M/PX | BANDS: B4,B3,B2 | SWATH: 290KM</p>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
        <h3 className="text-6xl font-bold text-white/5 uppercase tracking-[2rem] text-center">ANALYTICS</h3>
      </div>
    </div>
  );
};

export default MapMock;
