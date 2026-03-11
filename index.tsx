import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Satellite, Loader2, ChevronRight, ShieldAlert, Globe, MapPin } from 'lucide-react';
import { GeeService } from './services/GeeService';

const APP_VERSION = "v2.0.0";
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY;
const GMAP_KEY = import.meta.env.VITE_GMAP_KEY;
const DEFAULT_PROJECT_ID = 'gee-satellite-app-483808';

// 全局地图引擎标记，供 DataSearch 判断
export type MapEngine = 'google' | 'amap';
(window as any).__MAP_ENGINE__ = 'amap'; // 默认高德

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");
const root = ReactDOM.createRoot(rootElement);

// 检测是否能访问 Google（3秒超时）
const detectGoogleAccess = (): Promise<boolean> => {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 2000);
    fetch('https://www.google.com/generate_204', { mode: 'no-cors', cache: 'no-store' })
      .then(() => { clearTimeout(timer); resolve(true); })
      .catch(() => { clearTimeout(timer); resolve(false); });
  });
};

const loadGoogleMaps = (): Promise<void> => new Promise((resolve, reject) => {
  if ((window as any).google?.maps) return resolve();
  const script = document.createElement('script');
  script.src = `/proxy/maps/maps/api/js?key=${GMAP_KEY}&libraries=drawing,geometry,places&callback=__gm_cb__`;
  (window as any).__gm_cb__ = resolve;
  script.onerror = () => reject(new Error('Google Maps failed to load'));
  document.head.appendChild(script);
});

const loadAMap = (): Promise<void> => new Promise((resolve, reject) => {
  if ((window as any).AMap) return resolve();
  const script = document.createElement('script');
  script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${AMAP_KEY}&plugin=AMap.Scale`;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error('AMap failed to load'));
  document.head.appendChild(script);
});

const StartupLauncher = () => {
  const [projectId, setProjectId] = useState(localStorage.getItem('PROJECT_ID') || DEFAULT_PROJECT_ID);
  const [status, setStatus] = useState<'IDLE' | 'LOADING'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'google' | 'amap'>('checking');

  // 启动时自动检测网络
  useEffect(() => {
    detectGoogleAccess().then(hasGoogle => {
      const engine: MapEngine = hasGoogle ? 'google' : 'amap';
      (window as any).__MAP_ENGINE__ = engine;
      setNetworkStatus(engine);
    });
  }, []);

  const handleLaunch = async () => {
    if (!projectId.trim()) { setError('Please enter a Project ID.'); return; }
    setStatus('LOADING');
    setError(null);
    try {
      localStorage.setItem('PROJECT_ID', projectId.trim());
      await GeeService.authenticateManual('', projectId.trim());
      if ((window as any).__MAP_ENGINE__ === 'google') {
        await loadGoogleMaps();
      } else {
        await loadAMap();
      }
      root.render(<App />);
    } catch (err: any) {
      setError(err.message || 'Connection failed.');
      setStatus('IDLE');
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#020305] text-slate-200 flex flex-col items-center justify-center font-display antialiased overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,180,212,0.05),transparent_70%)] pointer-events-none" />
      <div className="flex flex-col items-center w-[440px] z-10">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="size-16 bg-gradient-to-br from-primary to-blue-600 rounded-[22px] flex items-center justify-center shadow-[0_0_40px_rgba(17,180,212,0.3)] mb-6">
            <Satellite size={32} className="text-black" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-[0.1em] text-white">SATELLITES GET <span className="text-primary">PRO</span></h1>
          <span className="mt-2 text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-400 font-mono">{APP_VERSION}</span>

          {/* 网络检测状态指示器 */}
          <div className="mt-3 flex items-center gap-2">
            {networkStatus === 'checking' ? (
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Loader2 size={10} className="animate-spin" /> Detecting network...
              </span>
            ) : networkStatus === 'google' ? (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <Globe size={10} /> Google Maps · VPN Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[10px] text-primary">
                <MapPin size={10} /> AMap Engine · No VPN Required
              </span>
            )}
          </div>
        </div>

        <div className="w-full bg-[#0a0c10] border border-white/10 rounded-[32px] p-8 shadow-2xl">
          <div className="flex flex-col gap-1 mb-6">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">GCP Project ID</label>
            <input value={projectId} onChange={e => setProjectId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLaunch()} placeholder="gee-satellite-app-483808" className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono text-slate-300 outline-none focus:border-primary/50 transition-all" />
          </div>
          {error && (
            <div className="mb-6 p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-start gap-3">
              <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-rose-300/80 font-mono leading-relaxed">{error}</p>
            </div>
          )}
          <button onClick={handleLaunch} disabled={status === 'LOADING' || !projectId.trim() || networkStatus === 'checking'} className="w-full bg-white hover:bg-primary text-black font-black text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-2">
            {status === 'LOADING' ? <><Loader2 className="animate-spin" size={16} /> Connecting...</> : <>Launch Mission Control <ChevronRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

root.render(<StartupLauncher />);
