
import React, { useState, useEffect, useRef } from 'react';
import { Database, Search, MousePointer2, Loader2, CheckCircle2, MapPin, UploadCloud, Info, Terminal, AlertCircle, X, ChevronRight, Settings2, ExternalLink, Cloud } from 'lucide-react';
import GoogleMapView, { GoogleMapRef } from '../components/GoogleMapView';
import { GeeService } from '../services/GeeService';
import { SatelliteResult } from '../types';

declare const google: any;

const ADMIN_FALLBACK: any[] = [
  { 
    code: '11', name: '北京市', 
    children: [{ code: '1101', name: '市辖区', children: [
      { code: '110101', name: '东城区' }, { code: '110102', name: '西城区' }, { code: '110105', name: '朝阳区' },
      { code: '110106', name: '丰台区' }, { code: '110108', name: '海淀区' }, { code: '110114', name: '昌平区' }
    ]}]
  }
];

interface DataSearchProps {
  addTask: (name: string, type: string) => void;
  addLog: (level: any, msg: string, payload?: any) => void;
  results: SatelliteResult[];
  setResults: (results: SatelliteResult[]) => void;
}

const DataSearch: React.FC<DataSearchProps> = ({ addTask, addLog, results, setResults }) => {
  const mapRef = useRef<GoogleMapRef>(null);
  const [roiMode, setRoiMode] = useState<'ADMIN' | 'DRAW' | 'FILE'>('ADMIN');
  const [cloudCover, setCloudCover] = useState(30); 
  const [dateStart, setDateStart] = useState('2024-01-01');
  const [dateEnd, setDateEnd] = useState('2024-10-31');
  
  const [loading, setLoading] = useState(false);
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SatelliteResult | null>(null);

  const [drawGeo, setDrawGeo] = useState<any>(null);
  const [fileGeo, setFileGeo] = useState<any>(null);

  const [divisions, setDivisions] = useState<any[]>(ADMIN_FALLBACK);
  const [selectedProv, setSelectedProv] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDist, setSelectedDist] = useState('');
  const [cities, setCities] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);

  const hasCurrentGeo = roiMode === 'ADMIN' ? !!selectedDist : roiMode === 'DRAW' ? !!drawGeo : !!fileGeo;
  
  const updateProcess = (msg: string) => {
    setProcessLogs(prev => [...prev.slice(-5), `> ${msg}`]);
  };

  useEffect(() => {
    fetch('https://unpkg.com/china-division/dist/pca-code.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setDivisions(data))
      .catch(() => addLog('WARN', '行政数据库载入离线模式'));
  }, []);

  const geocodeAdmin = async (names: string[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      const address = names.join('');
      updateProcess(`解析地理位置: ${address}`);
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address, componentRestrictions: { country: 'CN' } }, (res: any, status: any) => {
        if (status === 'OK' && res[0]) {
          const bounds = res[0].geometry.viewport || res[0].geometry.bounds;
          mapRef.current?.fitBounds(bounds);
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          const geoJson = {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [[
                [sw.lng(), sw.lat()],
                [ne.lng(), sw.lat()],
                [ne.lng(), ne.lat()],
                [sw.lng(), ne.lat()],
                [sw.lng(), sw.lat()]
              ]]
            }
          };
          updateProcess(`坐标投影转换完成: ${ne.lat().toFixed(2)}N`);
          resolve(geoJson);
        } else {
          reject(new Error(`地理编码失败: ${status}`));
        }
      });
    });
  };

  const handleSearch = async () => {
    setLoading(true);
    setAuthError(null);
    setProcessLogs(["正在初始化 GEE 搜索流水线..."]);
    setResults([]);
    setSelectedResult(null);

    try {
      let finalGeo;
      if (roiMode === 'ADMIN') {
        const pName = divisions.find(d => d.code === selectedProv)?.name || '';
        const cName = cities.find(c => c.code === selectedCity)?.name || '';
        const dName = districts.find(d => d.code === selectedDist)?.name || '';
        finalGeo = await geocodeAdmin([pName, cName, dName]);
      } else if (roiMode === 'DRAW') {
        finalGeo = drawGeo;
        updateProcess("应用勾画区域...");
      } else {
        finalGeo = fileGeo;
        updateProcess("应用上传文件...");
      }

      const data = await GeeService.searchSentinel2(
        finalGeo, 
        cloudCover, 
        dateStart, 
        dateEnd,
        updateProcess
      );
      
      setResults(data);
      if (data.length === 0) {
        updateProcess("结束: 所选范围内无 Sentinel-2 影像");
      } else {
        addLog('SUCCESS', `检索完成: ${data.length} 景影像`);
        updateProcess("全流程执行成功");
      }
    } catch (e: any) {
      setAuthError(e.message);
      updateProcess(`报错: ${e.message}`);
    } finally {
      if (!authError) {
        setTimeout(() => setLoading(false), 2000);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setFileGeo(json);
        mapRef.current?.addGeoJson(json);
        addLog('SUCCESS', '外部 ROI 载入成功');
      } catch (err) {
        addLog('ERROR', 'GeoJSON 格式错误');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <aside className="w-[420px] border-r border-border-dark bg-[#14161c] flex flex-col shrink-0 shadow-2xl z-20">
        <div className="p-6 border-b border-border-dark bg-background-dark/40">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-primary"><Database size={16} /> DATA EXPLORER</h2>
              <p className="text-[9px] text-slate-500 font-mono">ID: {GeeService.PROJECT_ID}</p>
            </div>
            <div className="bg-primary/10 border border-primary/30 px-2 py-0.5 rounded flex items-center gap-1.5">
              <span className="size-1.5 bg-primary rounded-full animate-pulse"></span>
              <span className="text-[9px] font-bold text-primary uppercase">GEE V2.3.1</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
          <section className="space-y-4">
            <div className="flex bg-background-dark p-1 rounded-2xl border border-border-dark">
              {['ADMIN', 'DRAW', 'FILE'].map(m => (
                <button 
                  key={m} 
                  onClick={() => {
                    setRoiMode(m as any);
                    mapRef.current?.clearOverlays();
                  }}
                  className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${roiMode === m ? 'bg-primary text-background-dark shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                  {m === 'ADMIN' ? '行政区划' : m === 'DRAW' ? '勾画区域' : '矢量上传'}
                </button>
              ))}
            </div>

            {roiMode === 'ADMIN' && (
              <div className="space-y-4">
                <select value={selectedProv} onChange={e => {
                  setSelectedProv(e.target.value); setSelectedCity(''); setSelectedDist('');
                  setCities(divisions.find(d => d.code === e.target.value)?.children || []);
                }} className="w-full bg-[#1e2128] border border-border-dark rounded-xl text-xs py-4 px-5 text-slate-300 outline-none">
                  <option value="">选择省份</option>
                  {divisions.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-4">
                  <select disabled={!selectedProv} value={selectedCity} onChange={e => {
                    setSelectedCity(e.target.value); setSelectedDist('');
                    setDistricts(cities.find(c => c.code === e.target.value)?.children || []);
                  }} className="bg-[#1e2128] border border-border-dark rounded-xl text-xs py-3.5 px-4 text-slate-300 disabled:opacity-30">
                    <option value="">城市</option>
                    {cities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                  <select disabled={!selectedCity} value={selectedDist} onChange={e => setSelectedDist(e.target.value)} className="bg-[#1e2128] border border-border-dark rounded-xl text-xs py-3.5 px-4 text-slate-300 disabled:opacity-30">
                    <option value="">区县</option>
                    {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {roiMode === 'DRAW' && (
              <div className="bg-[#1e2128] border-2 border-dashed border-border-dark rounded-[24px] p-8 text-center">
                <MousePointer2 size={24} className="text-primary mx-auto mb-4" />
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-relaxed">请在地图上方使用绘图工具</p>
                {drawGeo && <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-emerald-500 font-bold bg-emerald-500/5 py-2 rounded-xl border border-emerald-500/20"><CheckCircle2 size={12}/> ROI 已捕获</div>}
              </div>
            )}

            {roiMode === 'FILE' && (
              <label className="bg-[#1e2128] border-2 border-dashed border-border-dark rounded-[24px] p-10 text-center flex flex-col items-center gap-4 cursor-pointer hover:border-primary transition-all group">
                <UploadCloud size={32} className="text-slate-500 group-hover:text-primary transition-colors" />
                <span className="text-[10px] font-black text-slate-300 uppercase">载入 .geojson 文件</span>
                <input type="file" className="hidden" accept=".json,.geojson" onChange={handleFileUpload} />
              </label>
            )}
          </section>

          <section className="space-y-6 pt-6 border-t border-border-dark">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                <div className="flex items-center gap-2"><Cloud size={12} /> 最大云量限制</div>
                <span className="text-primary">{cloudCover}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={cloudCover} 
                onChange={(e) => setCloudCover(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[#1e2128] rounded-lg appearance-none cursor-pointer accent-primary" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-600 uppercase">开始日期</p>
                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full bg-[#1e2128] border border-border-dark rounded-xl text-[11px] p-3 text-slate-300 outline-none" />
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-600 uppercase">结束日期</p>
                <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full bg-[#1e2128] border border-border-dark rounded-xl text-[11px] p-3 text-slate-300 outline-none" />
              </div>
            </div>

            <button 
              onClick={handleSearch} 
              disabled={loading || !hasCurrentGeo} 
              className="w-full bg-primary text-background-dark font-black text-xs py-5 rounded-[22px] flex items-center justify-center gap-3 disabled:opacity-20 hover:scale-[1.02] transition-all"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
              {loading ? 'GEE API CALLING...' : '启动数据检索'}
            </button>
          </section>

          {results.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-border-dark">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">数据列表 ({results.length})</h3>
              <div className="space-y-3">
                {results.map((res) => (
                  <div 
                    key={res.id} 
                    onClick={() => {
                      setSelectedResult(res);
                      mapRef.current?.addGeoJson({ type: "Feature", geometry: { type: "Polygon", coordinates: [res.bounds.map(b => [b[1], b[0]])] } });
                    }} 
                    className={`group bg-[#1e2128] border rounded-2xl overflow-hidden cursor-pointer flex h-20 transition-all ${selectedResult?.id === res.id ? 'border-primary' : 'border-border-dark hover:border-slate-500'}`}
                  >
                    <div className="w-20 bg-black shrink-0">
                      <img src={res.thumbnail} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] font-bold text-slate-200">{res.date}</p>
                        <span className="text-[9px] font-black text-primary">CLOUD {res.cloudCover}%</span>
                      </div>
                      <p className="text-[9px] font-mono text-slate-600 truncate uppercase">{res.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 relative bg-black">
        <GoogleMapView ref={mapRef} showDrawingTools={roiMode === 'DRAW'} onGeometryChange={(geo) => setDrawGeo(geo)} />
        
        {loading && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[460px]">
            <div className="bg-[#14161c]/95 backdrop-blur-2xl border border-primary/20 p-8 rounded-[40px] shadow-2xl space-y-6 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-white">
                  <div className="bg-primary/20 p-2 rounded-xl"><Terminal size={18} className="text-primary" /></div>
                  <h3 className="text-xs font-black uppercase tracking-widest">Pipeline Health Monitor</h3>
                </div>
                {authError ? <AlertCircle className="text-rose-500" /> : <Loader2 className="animate-spin text-primary" />}
              </div>
              
              <div className="space-y-3 min-h-[100px]">
                {processLogs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-3 text-[10px] font-mono leading-relaxed ${log.includes('报错') ? 'text-rose-400' : (i === processLogs.length - 1 ? 'text-primary' : 'text-slate-500')}`}>
                    <ChevronRight size={10} className="mt-0.5" />
                    <span>{log}</span>
                  </div>
                ))}
              </div>

              {authError && (
                <div className="space-y-4 pt-4 border-t border-border-dark">
                  <div className="bg-rose-500/10 border border-rose-500/30 p-5 rounded-2xl space-y-3">
                    <p className="text-[10px] text-rose-300 font-bold uppercase tracking-widest">授权异常诊断：</p>
                    <ul className="text-[10px] text-rose-200/70 list-disc pl-4 space-y-1">
                      <li>确保 GC Console 中已启用 <b>Earth Engine API</b></li>
                      <li>项目 ID 必须为: <b>{GeeService.PROJECT_ID}</b></li>
                      <li>检查 API Key 是否受限（限制了 IP 或不含 GEE）</li>
                    </ul>
                  </div>
                  <button onClick={() => setLoading(false)} className="w-full py-4 bg-rose-500/20 text-rose-400 rounded-2xl text-[10px] font-bold uppercase tracking-widest">关闭诊断</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DataSearch;
