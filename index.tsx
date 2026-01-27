
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { 
  Satellite, Loader2, ChevronRight, ShieldAlert, Globe2, ServerCrash, 
  HelpCircle, X, Box, Key, UserCheck, Settings, Info, CheckCircle2, 
  Terminal, Command 
} from 'lucide-react';
import { GeeService } from './services/GeeService';

declare global {
  interface Window {
    google: {
      maps: any;
      accounts: {
        oauth2: {
          initTokenClient: (config: any) => { requestAccessToken: () => void };
        }
      }
    };
    ee: any;
    __google_maps_callback__: () => void;
    __MANUAL_KEY__: string | null;
  }
}

const APP_VERSION = "v1.5.0-stable";

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");
const root = ReactDOM.createRoot(rootElement);

const loadGoogleMaps = (key: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=drawing,geometry,places&callback=__google_maps_callback__`;
    window.__google_maps_callback__ = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script failed to load."));
    document.head.appendChild(script);
  });
};

const loadGoogleAuthLib = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Services failed."));
    document.head.appendChild(script);
  });
};

const SDK_SOURCES = [
  { url: "https://ajax.googleapis.com/ajax/libs/earthengine/0.1.392/client.min.js", name: "Google CDN" },
  { url: "https://cdn.jsdelivr.net/npm/@google/earthengine@0.1.392/build/ee_api_js.js", name: "JSDelivr Mirror" },
  { url: "https://unpkg.com/@google/earthengine@0.1.392/build/ee_api_js.js", name: "Unpkg Mirror" }
];

const loadGeeSdk = async (onProgress: (msg: string) => void): Promise<string> => {
  if (window.ee && window.ee.data) return "Already Loaded";
  for (const source of SDK_SOURCES) {
    try {
      onProgress(`Connecting to ${source.name}...`);
      await new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('gee-sdk-script');
        if (existing) existing.remove();
        const script = document.createElement('script');
        script.id = 'gee-sdk-script';
        script.src = source.url;
        script.async = true;
        const timeout = setTimeout(() => { script.remove(); reject(new Error("Timeout")); }, 5000);
        script.onload = () => {
          clearTimeout(timeout);
          if (window.ee && window.ee.initialize) resolve();
          else reject(new Error("Invalid Script"));
        };
        script.onerror = () => { clearTimeout(timeout); reject(new Error("Network Error")); };
        document.head.appendChild(script);
      });
      return source.name;
    } catch (e) { console.warn(`Failed source: ${source.name}`); }
  }
  throw new Error("All SDK mirrors failed. Check your network connection.");
};

const StartupLauncher = () => {
  const [config, setConfig] = useState({
    mapsApiKey: localStorage.getItem('MAPS_KEY') || '',
    clientId: localStorage.getItem('CLIENT_ID') || '',
    projectId: localStorage.getItem('PROJECT_ID') || ''
  });
  
  const [useManualToken, setUseManualToken] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'LOADING'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [sdkState, setSdkState] = useState<'CHECKING' | 'LOADED' | 'MISSING'>('CHECKING');
  const [loadingMsg, setLoadingMsg] = useState("Initializing Core...");
  const [connectedSource, setConnectedSource] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  const attemptLoadResources = async () => {
    setSdkState('CHECKING');
    setError(null);
    try {
      const sourceName = await loadGeeSdk(setLoadingMsg);
      setConnectedSource(sourceName);
      setSdkState('LOADED');
      setLoadingMsg("Loading Auth Lib...");
      await loadGoogleAuthLib();
    } catch (e: any) {
      setError(e.message);
      setSdkState('MISSING');
    }
  };

  useEffect(() => { attemptLoadResources(); }, []);

  const handleLaunch = async () => {
    const cleanMapsKey = config.mapsApiKey.trim();
    const cleanClientId = config.clientId.trim();
    const cleanProjectId = config.projectId.trim();

    if (!cleanMapsKey || (!useManualToken && !cleanClientId) || !cleanProjectId) {
      setError("Please fill in all security fields.");
      return;
    }

    setStatus('LOADING');
    try {
      localStorage.setItem('MAPS_KEY', cleanMapsKey);
      localStorage.setItem('CLIENT_ID', cleanClientId);
      localStorage.setItem('PROJECT_ID', cleanProjectId);
      window.__MANUAL_KEY__ = cleanMapsKey;
      await loadGoogleMaps(cleanMapsKey);
      if (useManualToken) await GeeService.authenticateManual(manualToken.trim(), cleanProjectId);
      else await GeeService.authenticate(cleanClientId, cleanProjectId);
      root.render(<App />);
    } catch (err: any) {
      setError(err.message || "Uplink sequence failed.");
      setStatus('IDLE');
    }
  };

  const isFormValid = config.mapsApiKey && config.projectId && ((!useManualToken && config.clientId) || (useManualToken && manualToken));

  return (
    <div className="min-h-screen w-screen bg-[#020305] text-slate-200 flex flex-col items-center justify-center font-display antialiased overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,180,212,0.05),transparent_70%)] pointer-events-none" />
      
      {/* GUIDE MODAL */}
      {showGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-4xl h-[85vh] bg-[#0d0f14] border border-white/10 rounded-[40px] flex flex-col overflow-hidden shadow-3xl animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary"><HelpCircle size={28} /></div>
                    <div>
                       <h3 className="text-xl font-black uppercase tracking-widest text-white">Platform Setup Guide</h3>
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">获取 GEE 与 GCP 核心凭据指引</p>
                    </div>
                 </div>
                 <button onClick={() => setShowGuide(false)} className="p-4 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-2xl"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12">
                 {/* Step 1: Project ID */}
                 <section className="space-y-6">
                    <div className="flex items-center gap-4">
                       <div className="size-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-primary font-black">01</div>
                       <h4 className="text-lg font-black text-white uppercase flex items-center gap-3"><Box size={20} className="text-primary" /> Project ID (项目 ID)</h4>
                    </div>
                    <div className="pl-14 space-y-4 text-left">
                       <p className="text-sm text-slate-400 leading-relaxed">这是你在 Google Cloud Console 中创建的项目唯一标识符。</p>
                       <div className="bg-black/40 rounded-3xl p-6 border border-white/5 space-y-3">
                          <p className="text-xs text-slate-300 font-bold flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> 获取步骤：</p>
                          <ol className="text-xs text-slate-500 space-y-2 list-decimal pl-4">
                             <li>前往 Google Cloud Console。</li>
                             <li>在顶部导航栏查看或创建项目。</li>
                             <li>复制项目的 ID (例如: ee-your-name)。</li>
                          </ol>
                       </div>
                    </div>
                 </section>

                 {/* Step 2: Maps API Key */}
                 <section className="space-y-6">
                    <div className="flex items-center gap-4">
                       <div className="size-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-primary font-black">02</div>
                       <h4 className="text-lg font-black text-white uppercase flex items-center gap-3"><Key size={20} className="text-primary" /> Maps API Key (地图密钥)</h4>
                    </div>
                    <div className="pl-14 space-y-4 text-left">
                       <p className="text-sm text-slate-400 leading-relaxed">用于加载 Google Maps 卫星底图及地理编码检索服务。</p>
                       <div className="bg-black/40 rounded-3xl p-6 border border-white/5 space-y-3">
                          <p className="text-xs text-slate-300 font-bold flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> 获取步骤：</p>
                          <ol className="text-xs text-slate-500 space-y-2 list-decimal pl-4">
                             <li>进入 GCP 控制台，启用 Maps JavaScript API 和 Geocoding API。</li>
                             <li>前往"凭据"页面，点击"创建凭据"并选择 API 密钥。</li>
                             <li>复制以 AIza 开头的字符串。</li>
                          </ol>
                       </div>
                    </div>
                 </section>

                 {/* Step 3: OAuth Client ID */}
                 <section className="space-y-6">
                    <div className="flex items-center gap-4">
                       <div className="size-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-primary font-black">03</div>
                       <h4 className="text-lg font-black text-white uppercase flex items-center gap-3"><UserCheck size={20} className="text-primary" /> OAuth Client ID (标准验证)</h4>
                    </div>
                    <div className="pl-14 space-y-4 text-left">
                       <p className="text-sm text-slate-400 leading-relaxed">浏览器弹出式安全验证，需要配置 Whitelist Origin。</p>
                       <div className="bg-black/40 rounded-3xl p-6 border border-white/5 space-y-5">
                          <div className="space-y-3">
                            <p className="text-xs text-slate-300 font-bold flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> 获取步骤：</p>
                            <ol className="text-xs text-slate-500 space-y-2 list-decimal pl-4">
                               <li>配置 OAuth 同意屏幕后，创建 OAuth 客户端 ID。</li>
                               <li>应用类型选择 Web 应用程序。</li>
                               <li>在"已获得许可的 JavaScript 来源"中添加当前应用的访问 URL (如: https://your-app.com)。</li>
                            </ol>
                          </div>
                       </div>
                    </div>
                 </section>

                 {/* Step 4: Manual Bypass Token */}
                 <section className="space-y-6 pb-10">
                    <div className="flex items-center gap-4">
                       <div className="size-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-primary font-black">04</div>
                       <h4 className="text-lg font-black text-white uppercase flex items-center gap-3"><Terminal size={20} className="text-primary" /> Manual Bypass (临时令牌)</h4>
                    </div>
                    <div className="pl-14 space-y-4 text-left">
                       <p className="text-sm text-slate-400 leading-relaxed">若无法配置 OAuth 域名来源，可使用手动令牌（1小时失效）。</p>
                       <div className="bg-black/40 rounded-3xl p-6 border border-white/5 space-y-6">
                          <div className="space-y-3">
                            <p className="text-xs text-primary font-bold flex items-center gap-2 uppercase tracking-widest"><Command size={14} /> 方法 A：GEE Code Editor 控制台 (推荐)</p>
                            <ol className="text-xs text-slate-500 space-y-2 list-decimal pl-4">
                               <li>登录 Earth Engine Code Editor 页面。</li>
                               <li>按 <kbd className="bg-white/10 px-1 rounded text-white font-mono">F12</kbd> 或 <kbd className="bg-white/10 px-1 rounded text-white font-mono">Cmd+Opt+J</kbd> 打开开发者工具控制台。</li>
                               <li>输入指令：<span className="text-emerald-400 font-mono bg-white/5 px-2 py-0.5 rounded">ee.data.getAuthToken()</span> 并回车。</li>
                               <li>复制返回结果中以 <span className="text-white font-bold">ya29</span> 开头的长字符串。</li>
                            </ol>
                          </div>
                          <div className="space-y-3 pt-3 border-t border-white/5">
                            <p className="text-xs text-slate-300 font-bold flex items-center gap-2 uppercase tracking-widest">方法 B：命令行 (gcloud CLI)</p>
                            <ol className="text-xs text-slate-500 space-y-2 list-decimal pl-4">
                               <li>确保已安装 Google Cloud SDK。</li>
                               <li>执行指令：<span className="text-primary font-mono bg-white/5 px-2 py-0.5 rounded">gcloud auth print-access-token</span></li>
                               <li>将输出的以 <span className="text-white font-bold">ya29</span> 开头的令牌复制到登录页的 Manual Token 框内。</li>
                            </ol>
                          </div>
                       </div>
                    </div>
                 </section>
              </div>

              <div className="p-8 bg-black/40 border-t border-white/5 flex justify-center">
                 <button onClick={() => setShowGuide(false)} className="bg-primary text-black px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                    I Got It, Back to Login
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* LOGIN UI */}
      <div className="flex flex-col items-center w-[500px] z-10">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="size-16 bg-gradient-to-br from-primary to-blue-600 rounded-[22px] flex items-center justify-center shadow-[0_0_40px_rgba(17,180,212,0.3)] mb-6">
            <Satellite size={32} className="text-black" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-[0.1em] text-white">SATELLITES GET and <span className="text-primary">AI PROCESS PRO</span></h1>
          <div className="mt-3 flex items-center gap-3">
             <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-400 font-mono">{APP_VERSION}</span>
             <button onClick={() => setShowGuide(true)} className="size-6 flex items-center justify-center text-[11px] font-black text-primary border border-primary/30 rounded-full hover:bg-primary hover:text-black transition-all group" title="Configuration Guide">
                <HelpCircle size={14} />
             </button>
          </div>
          
          <div className="mt-4 h-8 flex items-center">
            {sdkState === 'CHECKING' ? (
              <div className="flex items-center gap-2 text-[9px] text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                <Loader2 size={10} className="animate-spin" /> <span className="uppercase tracking-wider">{loadingMsg}</span>
              </div>
            ) : sdkState === 'LOADED' ? (
              <div className="flex items-center gap-2 text-[9px] text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <Globe2 size={10} /> <span className="uppercase tracking-wider font-bold">SDK: {connectedSource}</span>
              </div>
            ) : (
              <button onClick={attemptLoadResources} className="flex items-center gap-2 text-[9px] text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                <ServerCrash size={10} /> <span className="uppercase tracking-wider font-bold">RETRY CONNECTION</span>
              </button>
            )}
          </div>
        </div>

        <div className="w-full bg-[#0a0c10] border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none -mr-10 -mt-10">
            <Settings size={180} />
          </div>
          
          <div className="space-y-5 relative z-10 flex flex-col">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Maps API Key</label>
              <input value={config.mapsApiKey} onChange={e => setConfig({...config, mapsApiKey: e.target.value})} type="password" placeholder="AIza..." className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono text-slate-300 outline-none focus:border-primary/50 transition-all" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Project ID</label>
              <input value={config.projectId} onChange={e => setConfig({...config, projectId: e.target.value})} placeholder="ee-production" className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono text-slate-300 outline-none focus:border-primary/50 transition-all" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{useManualToken ? 'Manual Token' : 'OAuth Client ID'}</label>
                <button onClick={() => setUseManualToken(!useManualToken)} className="text-[9px] text-primary hover:text-white transition-colors">{useManualToken ? 'Use OAuth' : 'Manual Bypass'}</button>
              </div>
              {useManualToken ? (
                <textarea value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder="ya29.A0..." className="w-full h-20 bg-black/40 border border-primary/30 rounded-xl py-3 px-4 text-[10px] font-mono text-emerald-400 outline-none resize-none" />
              ) : (
                <input value={config.clientId} onChange={e => setConfig({...config, clientId: e.target.value})} placeholder="...apps.googleusercontent.com" className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono text-slate-300 outline-none focus:border-primary/50 transition-all" />
              )}
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2 relative z-10">
              <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-rose-300/80 font-mono leading-relaxed">{error}</p>
            </div>
          )}

          <button 
            onClick={handleLaunch} 
            disabled={status === 'LOADING' || !isFormValid || sdkState !== 'LOADED'} 
            className="w-full mt-8 bg-white hover:bg-primary text-black font-black text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-2 relative z-10"
          >
            {status === 'LOADING' ? <Loader2 className="animate-spin" size={16} /> : <>Start Tactical Uplink <ChevronRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

root.render(<StartupLauncher />);
