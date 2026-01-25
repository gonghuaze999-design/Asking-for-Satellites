
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Satellite, Loader2, ChevronRight, ShieldAlert, Globe2, KeyRound, ServerCrash, Terminal } from 'lucide-react';
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

const APP_VERSION = "v1.3.0-stable";
const APP_TITLE = "SATELLITES GET and AI PROCESS PRO";

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
  const [authLibState, setAuthLibState] = useState<'PENDING' | 'READY' | 'FAILED'>('PENDING');
  const [loadingMsg, setLoadingMsg] = useState("Initializing Core...");
  const [connectedSource, setConnectedSource] = useState("");

  const attemptLoadResources = async () => {
    setSdkState('CHECKING');
    setAuthLibState('PENDING');
    setError(null);
    try {
      const sourceName = await loadGeeSdk(setLoadingMsg);
      setConnectedSource(sourceName);
      setSdkState('LOADED');
      setLoadingMsg("Loading Auth Lib...");
      await loadGoogleAuthLib();
      setAuthLibState('READY');
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
    <div className="min-h-screen w-screen bg-[#020305] text-slate-200 flex items-center justify-center font-display antialiased overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,180,212,0.05),transparent_70%)] pointer-events-none" />
      <div className="relative w-[500px] z-10">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="size-16 bg-gradient-to-br from-primary to-blue-600 rounded-[22px] flex items-center justify-center shadow-[0_0_40px_rgba(17,180,212,0.3)] mb-6">
            <Satellite size={32} className="text-black" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-[0.1em] text-white max-w-[400px]">SATELLITES GET and <span className="text-primary">AI PROCESS PRO</span></h1>
          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-400 font-mono mt-3">{APP_VERSION}</span>
          
          <div className="mt-4 flex gap-2 h-8">
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

        <div className="bg-[#0a0c10] border border-white/10 rounded-[32px] p-8 shadow-2xl relative">
          <div className="space-y-5">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Maps API Key</label>
              <input value={config.mapsApiKey} onChange={e => setConfig({...config, mapsApiKey: e.target.value})} type="password" placeholder="AIza..." className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono text-slate-300 outline-none focus:border-primary/50 transition-all" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Project ID</label>
              <input value={config.projectId} onChange={e => setConfig({...config, projectId: e.target.value})} placeholder="ee-production" className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono text-slate-300 outline-none focus:border-primary/50 transition-all" />
            </div>
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
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
            <div className="mt-6 p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
              <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-rose-300/80 font-mono leading-relaxed">{error}</p>
            </div>
          )}

          <button 
            onClick={handleLaunch} 
            disabled={status === 'LOADING' || !isFormValid || sdkState !== 'LOADED'} 
            className="w-full mt-8 bg-white hover:bg-primary text-black font-black text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-2"
          >
            {status === 'LOADING' ? <Loader2 className="animate-spin" size={16} /> : <>Start Tactical Uplink <ChevronRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

root.render(<StartupLauncher />);
