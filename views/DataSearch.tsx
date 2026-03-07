
import React, { useState, useEffect, useRef } from 'react';
import { Database, Search, MousePointer2, Loader2, CheckCircle2, UploadCloud, Terminal, AlertCircle, ChevronRight, Cloud, Radio, Zap, X, Map as MapIcon, Calendar, Layers, Hash, Info, Target, Cpu, Compass, Activity, Trash2 } from 'lucide-react';
import MapView, { GoogleMapRef } from '../components/MapView';
import { GeeService } from '../services/GeeService';
import { SatelliteResult } from '../types';

declare const google: any;

const ADMIN_FALLBACK: any[] = [
  { 
    code: '11', name: 'Beijing', 
    children: [{ code: '1101', name: 'Metropolitan Area', children: [
      { code: '110101', name: 'Dongcheng' }, { code: '110102', name: 'Xicheng' }, { code: '110105', name: 'Chaoyang' }
    ]}]
  }
];

interface DataSearchProps {
  addTask: (name: string, type: string) => void;
  addLog: (level: any, msg: string, payload?: any) => void;
  results: SatelliteResult[];
  setResults: (results: SatelliteResult[]) => void;
  onRoiChange: (roi: any) => void;
}


// GCJ-02 → WGS84 坐标转换（高德→标准）
const gcj02ToWgs84 = (lng: number, lat: number) => {
  const a = 6378245.0, ee = 0.00669342162296594323;
  const transformLat = (x: number, y: number) => {
    let r = -100+2*x+3*y+0.2*y*y+0.1*x*y+0.2*Math.sqrt(Math.abs(x));
    r += (20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;
    r += (20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3;
    r += (160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3;
    return r;
  };
  const transformLng = (x: number, y: number) => {
    let r = 300+x+2*y+0.1*x*x+0.1*x*y+0.1*Math.sqrt(Math.abs(x));
    r += (20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;
    r += (20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3;
    r += (150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3;
    return r;
  };
  let dlat = transformLat(lng-105, lat-35), dlng = transformLng(lng-105, lat-35);
  const radlat = lat/180*Math.PI;
  let magic = Math.sin(radlat); magic = 1-ee*magic*magic;
  const sq = Math.sqrt(magic);
  dlat = dlat*180/((a*(1-ee))/(magic*sq)*Math.PI);
  dlng = dlng*180/(a/sq*Math.cos(radlat)*Math.PI);
  return { lng: 2*lng-( lng+dlng), lat: 2*lat-(lat+dlat) };
};

const DataSearch: React.FC<DataSearchProps> = ({ addTask, addLog, results, setResults, onRoiChange }) => {
  const mapRef = useRef<GoogleMapRef>(null);
  // 运行时判断地图引擎（__MAP_ENGINE__在App启动后才设置）
  const [roiMode, setRoiMode] = useState<'ADMIN' | 'DRAW' | 'FILE'>('ADMIN');
  const [cloudCover, setCloudCover] = useState(30);
  const [minCoverage, setMinCoverage] = useState(0);
  const [dateStart, setDateStart] = useState('2024-01-01');
  const [dateEnd, setDateEnd] = useState('2024-10-31');
  
  const [loading, setLoading] = useState(false);
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  
  const [selectedResult, setSelectedResult] = useState<SatelliteResult | null>(null);
  const [tileLoading, setTileLoading] = useState(false);

  const [drawGeo, setDrawGeo] = useState<any>(null);
  const [fileGeo, setFileGeo] = useState<any>(null);

  const [divisions, setDivisions] = useState<any[]>(ADMIN_FALLBACK);
  const [selectedProv, setSelectedProv] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDist, setSelectedDist] = useState('');
  const [cities, setCities] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);

  const hasCurrentGeo = roiMode === 'ADMIN' ? !!selectedDist : roiMode === 'DRAW' ? !!drawGeo : !!fileGeo;
  const updateProcess = (msg: string) => setProcessLogs(prev => [...prev.slice(-4), `> ${msg}`]);

  useEffect(() => {
    fetch('https://unpkg.com/china-division/dist/pca-code.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setDivisions(data))
      .catch(() => addLog('WARN', 'Administrative database in offline mode'));
  }, []);

  useEffect(() => {
    if (roiMode === 'DRAW') onRoiChange(drawGeo);
    if (roiMode === 'FILE') onRoiChange(fileGeo);
  }, [drawGeo, fileGeo, roiMode]);

  // 省、市、县每级选择后立刻定位地图
  useEffect(() => {
    if (roiMode !== 'ADMIN' || !selectedProv) return;
    const pName = divisions.find(d => d.code === selectedProv)?.name || '';
    geocodeAdmin([pName]).catch(() => {});
  }, [selectedProv]);

  useEffect(() => {
    if (roiMode !== 'ADMIN' || !selectedCity) return;
    const pName = divisions.find(d => d.code === selectedProv)?.name || '';
    const cName = cities.find(c => c.code === selectedCity)?.name || '';
    geocodeAdmin([pName, cName]).catch(() => {});
  }, [selectedCity]);

  useEffect(() => {
    if (roiMode !== 'ADMIN' || !selectedDist) return;
    const pName = divisions.find(d => d.code === selectedProv)?.name || '';
    const cName = cities.find(c => c.code === selectedCity)?.name || '';
    const dName = districts.find(d => d.code === selectedDist)?.name || '';
    geocodeAdmin([pName, cName, dName]).catch(() => {});
  }, [selectedDist]);

  const geocodeAdmin = async (names: string[]): Promise<any> => {
    const address = names.filter(Boolean).join('');
    updateProcess(`Resolving Address: ${address}`);
    // 统一走服务器端内置坐标库，不依赖任何地图SDK的Geocoder
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
    if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
    const data = await res.json();
    if (!data.bounds) throw new Error(data.error || 'Geocoding failed');
    const { sw, ne } = data.bounds;
    mapRef.current?.fitBounds({ sw, ne });
    const geo = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[sw.lng,sw.lat],[ne.lng,sw.lat],[ne.lng,ne.lat],[sw.lng,ne.lat],[sw.lng,sw.lat]]]
      }
    };
    onRoiChange(geo);
    return geo;
  };

  const handleSearch = async () => {
    setLoading(true);
    setAuthError(null);
    setProcessLogs(["Initializing GEE comms..."]);
    setResults([]);
    setSelectedResult(null);
    mapRef.current?.clearOverlays();
    
    try {
      let finalGeo;
      if (roiMode === 'ADMIN') {
        const pName = divisions.find(d => d.code === selectedProv)?.name || '';
        const cName = cities.find(c => c.code === selectedCity)?.name || '';
        const dName = districts.find(d => d.code === selectedDist)?.name || '';
        finalGeo = await geocodeAdmin([pName, cName, dName]);
      } else finalGeo = roiMode === 'DRAW' ? drawGeo : fileGeo;

      updateProcess(`ROI Locked: Fetching Sentinel-2 (${dateStart} - ${dateEnd})`);
      const data = await GeeService.searchSentinel2(finalGeo, cloudCover, dateStart, dateEnd, updateProcess);
      setResults(data);
      if (data.length > 0) {
        addLog('SUCCESS', `Search finished: Found ${data.length} Sentinel-2 scenes`);
        updateProcess(`Success: ${data.length} results`);
      } else {
        addLog('INFO', 'Search finished: No matching scenes found');
        updateProcess('Result: 0 records found');
      }
    } catch (e: any) {
      setAuthError(e.message);
      updateProcess(`Critical Error: ${e.message}`);
      addLog('ERROR', `SEARCH_FAILED: ${e.message}`);
    } finally {
      updateProcess("Session ended.");
      setTimeout(() => setLoading(false), 2000);
    }
  };

  const handleResultClick = async (res: SatelliteResult) => {
    setSelectedResult(res);
    setTileLoading(true);

    if (res.bounds && Array.isArray(res.bounds) && res.bounds.length > 2) {
      try {
        const coords = res.bounds.map(b => [b[1], b[0]]);
        if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) coords.push(coords[0]);
        mapRef.current?.addGeoJson({ type: "Feature", geometry: { type: "Polygon", coordinates: [coords] } });
      } catch (e) { addLog('WARN', 'Invalid geometry information'); }
    }

    try {
        const mapIdUrl = await GeeService.getOverlayMapId(res.id);
        if (mapIdUrl) {
            mapRef.current?.addTileLayer(mapIdUrl);
            addLog('SUCCESS', `High-res layer loaded: ${res.id}`);
        }
    } catch (e: any) {
        addLog('ERROR', `Layer load failed: ${e.message}`);
    } finally { setTileLoading(false); }
  };

  const handleDeleteResult = (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); 
      const newResults = results.filter(r => r.id !== id);
      setResults(newResults);
      if (selectedResult?.id === id) {
          closeInspector();
      }
      addLog('INFO', `Removed image ${id.split('/').pop()} from analysis pool.`);
  };

  const closeInspector = () => {
      setSelectedResult(null);
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <aside className="w-[340px] border-r border-white/5 bg-[#14161c] flex flex-col shrink-0 z-20 overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-black/10 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Database size={12} /> Data Center</h2>
            <div className={`flex items-center gap-2 px-2 py-0.5 rounded-full border border-white/5 text-[7px] font-black uppercase tracking-tighter bg-emerald-500/10 text-emerald-500`}>
              <Zap size={8} /> LIVE CONNECTION
            </div>
          </div>
          
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mb-4">
            {['ADMIN', 'DRAW', 'FILE'].map(m => (
              <button key={m} onClick={() => { setRoiMode(m as any); mapRef.current?.clearOverlays(); }} className={`flex-1 py-1.5 text-[8px] font-black rounded-lg transition-all uppercase tracking-widest ${roiMode === m ? 'bg-primary text-black' : 'text-slate-500'}`}>
                {m === 'ADMIN' ? 'Division' : m === 'DRAW' ? 'Sketch' : 'Files'}
              </button>
            ))}
          </div>

          <div className="space-y-2 mb-4">
            {roiMode === 'ADMIN' && (
              <div className="space-y-1.5">
                <select value={selectedProv} onChange={e => {
                  setSelectedProv(e.target.value); setSelectedCity(''); setSelectedDist('');
                  setCities(divisions.find(d => d.code === e.target.value)?.children || []);
                }} className="w-full bg-black/40 border border-white/5 rounded-lg text-[10px] py-2 px-3 text-slate-300 outline-none">
                  <option value="">Province / State</option>
                  {divisions.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select disabled={!selectedProv} value={selectedCity} onChange={e => {
                    setSelectedCity(e.target.value); setSelectedDist('');
                    setDistricts(cities.find(c => c.code === e.target.value)?.children || []);
                  }} className="bg-black/40 border border-white/5 rounded-lg text-[10px] py-2 px-3 text-slate-300 disabled:opacity-30 outline-none"><option value="">City</option>{cities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
                  <select disabled={!selectedCity} value={selectedDist} onChange={e => setSelectedDist(e.target.value)} className="bg-black/40 border border-white/5 rounded-lg text-[10px] py-2 px-3 text-slate-300 disabled:opacity-30 outline-none"><option value="">District</option>{districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}</select>
                </div>
              </div>
            )}
            {roiMode === 'DRAW' && <div className="bg-black/20 border border-dashed border-white/10 rounded-xl p-3 text-center"><p className="text-[8px] text-slate-500 uppercase font-black">Use drawing tools on top map</p>{drawGeo && <div className="mt-1 text-[8px] text-emerald-400 font-bold uppercase">ROI Ready</div>}</div>}
            {roiMode === 'FILE' && <label className="bg-black/20 border border-dashed border-white/10 rounded-xl p-3 text-center flex flex-col items-center gap-1 cursor-pointer hover:border-primary transition-all"><UploadCloud size={14} className="text-slate-500" /><span className="text-[8px] font-black text-slate-400 uppercase">LOAD .GEOJSON</span><input type="file" className="hidden" accept=".json,.geojson" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => { const json = JSON.parse(ev.target?.result as string); setFileGeo(json); mapRef.current?.addGeoJson(json); }; reader.readAsText(file); }} /></label>}
          </div>

          <div className="space-y-3">
            <div className="space-y-1"><div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-1.5"><Cloud size={10} /> Cloud {cloudCover}%</div></div><input type="range" min="0" max="100" value={cloudCover} onChange={e => setCloudCover(parseInt(e.target.value))} className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-primary" /></div>
            <div className="space-y-1"><div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-500"><div className="flex items-center gap-1.5"><Layers size={10} /> Coverage ≥{minCoverage}%</div></div><input type="range" min="0" max="100" value={minCoverage} onChange={e => setMinCoverage(parseInt(e.target.value))} className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-primary" /></div>
            <div className="grid grid-cols-2 gap-2"><input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-lg text-[9px] py-2 px-2 text-slate-300 outline-none" /><input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-lg text-[9px] py-2 px-2 text-slate-300 outline-none" /></div>
            <button onClick={handleSearch} disabled={loading || !hasCurrentGeo} className="w-full bg-primary text-black font-black text-[10px] uppercase tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-20 hover:scale-[1.01] transition-all">{loading ? <Loader2 className="animate-spin" size={12} /> : <Search size={12} />} Launch Retrieval</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {authError && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2"><div className="flex items-center gap-2 text-rose-500"><AlertCircle size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Error</span></div><p className="text-[9px] text-rose-300 font-mono leading-relaxed">{authError}</p></div>}
          {results.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">MATCHED IMAGERY ({results.length})</h3>
              <div className="grid grid-cols-1 gap-2">
                {results.map((res) => (
                  <div key={res.id} onClick={() => handleResultClick(res)} className={`group bg-black/20 border rounded-xl overflow-hidden cursor-pointer flex h-14 transition-all relative ${selectedResult?.id === res.id ? 'border-primary shadow-[0_0_10px_rgba(17,180,212,0.1)]' : 'border-white/5 hover:border-white/10'}`}>
                    <div className="w-14 bg-black shrink-0 relative">{res.thumbnail ? <img src={res.thumbnail} className="w-full h-full object-cover group-hover:opacity-100" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 text-[8px]">NO IMG</div>}{selectedResult?.id === res.id && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center backdrop-blur-[1px]">{tileLoading ? <Loader2 size={12} className="animate-spin text-white" /> : <MapIcon size={12} className="text-white drop-shadow-md" />}</div>}</div>
                    <div className="flex-1 p-2 flex flex-col justify-center min-w-0"><div className="flex justify-between items-center mb-0.5"><p className="text-[9px] font-bold text-slate-300">{res.date}</p><span className="text-[8px] font-black text-primary/80">C:{res.cloudCover}%</span></div><p className="text-[7px] font-mono text-slate-600 truncate uppercase" title={res.id}>{res.id.split('/').pop()}</p></div>
                    <button 
                        onClick={(e) => handleDeleteResult(e, res.id)} 
                        className="absolute bottom-1 right-1 p-1.5 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Remove from Analysis Pool"
                    >
                        <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading && !authError && <div className="h-full flex flex-col items-center justify-center opacity-20 py-10"><Database size={32} /><p className="text-[8px] font-black uppercase mt-2">No Data</p></div>}
        </div>
      </aside>

      <main className="flex-1 relative bg-black">
        <MapView ref={mapRef} showDrawingTools={roiMode === 'DRAW'} onGeometryChange={setDrawGeo} />
        {loading && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[280px]">
            <div className="bg-[#14161c]/90 backdrop-blur-xl border border-white/10 p-5 rounded-[24px] shadow-2xl space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><Terminal size={12} /> GEE Pipeline</h3><Loader2 className="animate-spin text-primary" size={12} /></div>
              <div className="space-y-1 bg-black/40 p-2 rounded-lg">{processLogs.map((log, i) => <div key={i} className={`flex items-start gap-2 text-[8px] font-mono ${log.includes('Error') || log.includes('Failed') ? 'text-rose-400' : 'text-slate-500'}`}><ChevronRight size={8} className="mt-0.5 shrink-0" /> <span className="truncate">{log}</span></div>)}</div>
            </div>
          </div>
        )}

        {selectedResult && !loading && (
          <div className="absolute top-6 right-6 w-80 bg-[#14161c]/95 backdrop-blur-md border border-white/10 rounded-[24px] shadow-2xl overflow-hidden animate-in slide-in-from-right-4 duration-300">
             <div className="p-4 border-b border-white/5 flex items-start justify-between bg-white/5">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-primary/10 rounded-lg text-primary"><Info size={16} /></div>
                   <div><h3 className="text-[10px] font-black uppercase tracking-widest text-white">Image Inspector</h3><p className="text-[8px] text-slate-500 font-mono mt-0.5">MGRS: {selectedResult.tileId}</p></div>
                </div>
                <button onClick={closeInspector} className="text-slate-500 hover:text-white transition-colors p-1"><X size={16} /></button>
             </div>
             
             <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2 text-slate-500 mb-1"><Calendar size={10} /><span className="text-[8px] font-black uppercase tracking-widest">Sensing Time</span></div>
                      <p className="text-[10px] font-bold text-slate-200">{selectedResult.metadata.sensingTime}</p>
                   </div>
                   <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2 text-slate-500 mb-1"><Cloud size={10} /><span className="text-[8px] font-black uppercase tracking-widest">Cloud Density</span></div>
                      <p className="text-[10px] font-bold text-emerald-400">{selectedResult.cloudCover}%</p>
                   </div>
                </div>

                <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2 text-slate-500"><Target size={10} /><span className="text-[8px] font-black uppercase tracking-widest">Platform</span></div>
                        <span className="text-[9px] font-bold text-primary">{selectedResult.metadata.platform}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2 text-slate-500"><Layers size={10} /><span className="text-[8px] font-black uppercase tracking-widest">Data Level</span></div>
                        <span className="text-[9px] font-bold text-white">{selectedResult.metadata.dataLevel}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2 text-slate-500"><Cpu size={10} /><span className="text-[8px] font-black uppercase tracking-widest">Resolution</span></div>
                        <span className="text-[9px] font-bold text-emerald-400">{selectedResult.metadata.resolution}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-500"><Radio size={10} /><span className="text-[8px] font-black uppercase tracking-widest">Spectral Bands</span></div>
                        <span className="text-[9px] font-bold text-white">{selectedResult.metadata.bands}</span>
                    </div>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DataSearch;
