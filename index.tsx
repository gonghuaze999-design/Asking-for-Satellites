
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Satellite, Loader2, ChevronRight, AlertCircle, ShieldAlert, WifiOff, RefreshCw, Globe2, ServerCrash, KeyRound, Terminal, CheckCircle2 } from 'lucide-react';
import { GeeService } from './services/GeeService';

// Extend window interface
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

const APP_VERSION = "v1.0.0-stable";

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");
const root = ReactDOM.createRoot(rootElement);

// Load Google Maps
const loadGoogleMaps = (key: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=drawing,geometry,places&callback=__google_maps_callback__`;
    window.__google_maps_callback__ = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script failed to load. Check your network or API Key."));
    document.head.appendChild(script);
  });
};

// Load Google Identity Services (REQUIRED for GEE Auth)
const loadGoogleAuthLib = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement('script');
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Services failed to load. Check VPN (accounts.google.com)."));
    document.head.appendChild(script);
  });
};

// --- SMART MULTI-SOURCE LOADER ---
// Using 0.1.392 as it is known to be very stable with the current Auth flow.
const SDK_SOURCES = [
  { url: "https://ajax.googleapis.com/ajax/libs/earthengine/0.1.392/client.min.js", name: "Google CDN" },
  { url: "https://cdn.jsdelivr.net/npm/@google/earthengine@0.1.392/build/ee_api_js.js", name: "JSDelivr Mirror (Stable)" },
  { url: "https://unpkg.com/@google/earthengine@0.1.392/build/ee_api_js.js", name: "Unpkg Mirror" }
];

const loadGeeSdk = async (onProgress: (msg: string) => void): Promise<string> => {
  if (window.ee && window.ee.data) return "Already Loaded";

  for (const source of SDK_SOURCES) {
    try {
      onProgress(`Connecting to ${source.name}...`);
      await new Promise<void>((resolve, reject) => {
        // Cleanup previous attempts
        const existing = document.getElementById('gee-sdk-script');
        if (existing) existing.remove();

        const script = document.createElement('script');
        script.id = 'gee-sdk-script';
        script.src = source.url;
        script.async = true;
        
        // Timeout protection (5 seconds per source)
        const timeout = setTimeout(() => {
          script.remove(); // Stop loading
          reject(new Error("Timeout"));
        }, 5000);

        script.onload = () => {
          clearTimeout(timeout);
          if (window.ee && window.ee.initialize) {
            resolve();
          } else {
            reject(new Error("Invalid Script"));
          }
        };
        
        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Network Error"));
        };
        
        document.head.appendChild(script);
      });
      return source.name; // Success
    } catch (e) {
      console.warn(`Failed to load from ${source.name}`, e);
      // Continue to next source
    }
  }
  throw new Error("All mirrors failed. Please check your internet connection.");
};

const StartupLauncher = () => {
  const [config, setConfig] = useState({
    mapsApiKey: localStorage.getItem('MAPS_KEY') || '',
    clientId: localStorage.getItem('CLIENT_ID') || '',
    projectId: localStorage.getItem('PROJECT_ID') || ''
  });
  
  // New State for Manual Token
  const [useManualToken, setUseManualToken] = useState(false);
  const [manualToken, setManualToken] = useState('');

  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'READY'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  
  // SDK Loading State
  const [sdkState, setSdkState] = useState<'CHECKING' | 'LOADED' | 'MISSING'>('CHECKING');
  const [authLibState, setAuthLibState] = useState<'PENDING' | 'READY' | 'FAILED'>('PENDING');
  
  const [loadingMsg, setLoadingMsg] = useState("Initializing...");
  const [connectedSource, setConnectedSource] = useState<string>("");

  const attemptLoadResources = async () => {
    setSdkState('CHECKING');
    setAuthLibState('PENDING');
    setError(null);
    
    try {
      // 1. Load GEE SDK
      const sourceName = await loadGeeSdk(setLoadingMsg);
      setConnectedSource(sourceName);
      setSdkState('LOADED');
      
      // 2. Load Auth Lib (Parallel or Sequential)
      setLoadingMsg("Loading Auth Lib...");
      await loadGoogleAuthLib();
      setAuthLibState('READY');

    } catch (e: any) {
      console.error(e);
      setError(e.message);
      setSdkState('MISSING');
    }
  };

  useEffect(() => {
    attemptLoadResources();
  }, []);

  const handleLaunch = async () => {
    if (sdkState !== 'LOADED' || authLibState !== 'READY') {
      setError("Cannot proceed: Essential Google libraries are missing.");
      return;
    }

    // Input Validation & Sanitization
    const cleanMapsKey = config.mapsApiKey.trim();
    const cleanClientId = config.clientId.trim();
    const cleanProjectId = config.projectId.trim();
    const cleanToken = manualToken.trim();

    if (!cleanMapsKey || (!useManualToken && !cleanClientId) || !cleanProjectId) {
      setError("Please fill in all required fields.");
      return;
    }

    if (useManualToken && !cleanToken) {
       setError("Please enter the Access Token.");
       return;
    }

    setStatus('LOADING');
    setError(null);
    
    try {
      // 1. Save Config
      localStorage.setItem('MAPS_KEY', cleanMapsKey);
      localStorage.setItem('CLIENT_ID', cleanClientId);
      localStorage.setItem('PROJECT_ID', cleanProjectId);
      window.__MANUAL_KEY__ = cleanMapsKey;

      // 2. Load Maps
      await loadGoogleMaps(cleanMapsKey);

      // 3. Authenticate Real GEE
      if (useManualToken) {
        // --- MANUAL BYPASS FLOW ---
        await GeeService.authenticateManual(cleanToken, cleanProjectId);
      } else {
        // --- STANDARD OAUTH FLOW ---
        await GeeService.authenticate(cleanClientId, cleanProjectId);
      }
      
      // 4. Enter App
      root.render(<App />);

    } catch (err: any) {
      console.error("Launch Failed:", err);
      // Format error for display
      let msg = err.message || "Unknown Connection Error";
      if (msg.includes("cookies")) msg = "Cookies blocked. Enable 3rd-party cookies.";
      if (msg.includes("origin")) msg = "Origin Error: Add this domain to 'Authorized Origins' in GCP Console.";
      if (msg.includes("popups")) msg = "Popup blocked. Please allow popups for this site.";
      if (msg.includes("closed")) msg = "Popup closed by user.";
      setError(msg);
      setStatus('IDLE');
    }
  };

  const isFormValid = config.mapsApiKey && config.projectId && ((!useManualToken && config.clientId) || (useManualToken && manualToken));

  return (
    <div className="min-h-screen w-screen bg-[#020305] text-slate-200 flex items-center justify-center font-display antialiased overflow-hidden selection:bg-primary/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,180,212,0.05),transparent_70%)] pointer-events-none" />
      
      <div className="relative w-[500px] z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="size-16 bg-gradient-to-br from-primary to-blue-600 rounded-[22px] flex items-center justify-center shadow-[0_0_40px_rgba(17,180,212,0.3)] mb-6">
            <Satellite size={32} className="text-black" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-white">Workbench <span className="text-primary">Pro</span></h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-400 font-mono">{APP_VERSION}</span>
          </div>
          
          <div className="mt-4 flex flex-col items-center gap-2 h-10">
            {sdkState === 'CHECKING' && (
              <div className="flex items-center gap-2 text-[9px] text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                <Loader2 size={10} className="animate-spin" /> 
                <span className="uppercase tracking-wider">{loadingMsg}</span>
              </div>
            )}
            
            {(sdkState === 'LOADED' && authLibState === 'READY') && (
              <div className="flex items-center gap-2">
                 <div className="flex items-center gap-2 text-[9px] text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    <Globe2 size={10} />
                    <span className="uppercase tracking-wider font-bold">SDK: {connectedSource}</span>
                 </div>
                 <div className="flex items-center gap-2 text-[9px] text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    <KeyRound size={10} />
                    <span className="uppercase tracking-wider font-bold">AUTH LIB READY</span>
                 </div>
              </div>
            )}

            {(sdkState === 'MISSING' || authLibState === 'FAILED') && (
              <button 
                onClick={attemptLoadResources}
                className="flex items-center gap-2 text-[9px] text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer"
              >
                <ServerCrash size={10} />
                <span className="uppercase tracking-wider font-bold">CONNECTION FAILED - RETRY?</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#0a0c10] border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
          {/* Status Bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 opacity-50" />

          <div className="space-y-6">
            <div className="space-y-4">
               {/* Maps Key always required */}
               <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Google Maps API Key</label>
                 <input value={config.mapsApiKey} onChange={e => setConfig({...config, mapsApiKey: e.target.value})} type="password" placeholder="AIza..." className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono outline-none focus:border-primary/50 text-slate-300 focus:text-primary transition-all" />
               </div>

               {/* Project ID always required */}
               <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cloud Project ID</label>
                 <input value={config.projectId} onChange={e => setConfig({...config, projectId: e.target.value})} placeholder="my-project-id" className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono outline-none focus:border-primary/50 text-slate-300 focus:text-primary transition-all" />
               </div>

               {/* Toggle between OAuth and Manual Token */}
               <div className="pt-2">
                 <div className="flex items-center justify-between mb-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{useManualToken ? 'Access Token (Manual Bypass)' : 'OAuth 2.0 Client ID'}</label>
                    <button 
                        onClick={() => setUseManualToken(!useManualToken)} 
                        className="text-[9px] text-primary hover:text-white underline decoration-dashed underline-offset-4 transition-colors"
                    >
                        {useManualToken ? 'Use Standard OAuth' : 'Having Auth Issues? Enter Token Manually'}
                    </button>
                 </div>
                 
                 {useManualToken ? (
                    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                        <textarea 
                            value={manualToken} 
                            onChange={e => setManualToken(e.target.value)} 
                            placeholder="Paste access token (starts with ya29...)" 
                            className="w-full h-20 bg-black/40 border border-primary/30 rounded-xl py-3 px-4 text-[10px] font-mono outline-none focus:border-primary text-emerald-400 resize-none" 
                        />
                        <div className="flex gap-2 items-start bg-primary/5 p-2 rounded-lg border border-primary/10">
                            <Terminal size={12} className="text-primary mt-0.5 shrink-0" />
                            <p className="text-[8px] text-slate-400 leading-relaxed">
                                <span className="text-primary font-bold">Step 1:</span> Open <a href="https://code.earthengine.google.com" target="_blank" className="text-white underline">GEE Code Editor</a>.<br/>
                                <span className="text-primary font-bold">Step 2:</span> Press <strong className="text-white">F12</strong> to open Browser Console.<br/>
                                <span className="text-primary font-bold">Step 3:</span> Type <code className="bg-white/10 px-1 rounded text-white">ee.data.getAuthToken()</code> and press Enter.<br/>
                                <span className="text-primary font-bold">Step 4:</span> Copy the text (without quotes) and paste above.
                            </p>
                        </div>
                    </div>
                 ) : (
                    <input 
                        value={config.clientId} 
                        onChange={e => setConfig({...config, clientId: e.target.value})} 
                        placeholder="...apps.googleusercontent.com" 
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono outline-none focus:border-primary/50 text-slate-300 focus:text-primary transition-all" 
                    />
                 )}
               </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
              <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Connection Error</p>
                <p className="text-[10px] text-rose-300/80 font-mono leading-relaxed">{error}</p>
                {error.includes("Origin") && (
                    <p className="mt-2 text-[9px] text-slate-400">
                        Check that <b>{window.location.origin}</b> is added to "Authorized JavaScript origins" in your Google Cloud Console Credentials.
                    </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-8">
            <button 
              onClick={handleLaunch} 
              disabled={status === 'LOADING' || !isFormValid || sdkState !== 'LOADED' || authLibState !== 'READY'} 
              className="w-full bg-white hover:bg-primary text-black font-bold text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all active:scale-95 disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {status === 'LOADING' ? <Loader2 className="animate-spin" size={16} /> : <>Connect to Earth Engine <ChevronRight size={16} /></>}
            </button>
          </div>
          
          <div className="mt-6 text-center">
             <p className="text-[8px] text-slate-600 font-mono">STRICT MODE • MULTI-SOURCE SDK & AUTH ACTIVE</p>
          </div>
        </div>
      </div>
    </div>
  );
};

root.render(<StartupLauncher />);
