
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Satellite, ShieldCheck, Zap, Key, Loader2 } from 'lucide-react';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    google: any;
    __google_maps_callback__: () => void;
    gm_authFailure: () => void;
    aistudio?: AIStudio;
    __MANUAL_KEY__: string | null;
  }
}

window.__MANUAL_KEY__ = null;

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");
const root = ReactDOM.createRoot(rootElement);

// 动态加载 Google Maps 脚本
const loadGoogleMaps = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    // 增加 async 属性并优化 URL 参数
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry,places&loading=async&callback=__google_maps_callback__`;
    script.async = true;
    script.defer = true;
    
    window.__google_maps_callback__ = () => resolve();
    script.onerror = () => reject(new Error('Google Maps SDK 加载失败，请检查 API Key 权限。'));
    document.head.appendChild(script);
  });
};

const StartupLauncher = () => {
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'READY'>('IDLE');
  const [manualKey, setManualKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const initEngineAndStart = async (keyToUse: string) => {
    setStatus('LOADING');
    setError(null);
    try {
      window.__MANUAL_KEY__ = keyToUse;
      await loadGoogleMaps(keyToUse);
      setStatus('READY');
      root.render(<App />);
    } catch (err: any) {
      setError(err.message || '启动失败');
      setStatus('IDLE');
    }
  };

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = manualKey.trim();
    if (!trimmedKey) return;
    initEngineAndStart(trimmedKey);
  };

  const handleSystemConnect = async () => {
    try {
      if (window.aistudio) await window.aistudio.openSelectKey();
      const systemKey = process.env.API_KEY;
      if (systemKey && systemKey !== 'GEMINI_API_KEY') {
        initEngineAndStart(systemKey);
      } else {
        setError('系统未检测到有效的默认密钥，请手动输入。');
      }
    } catch (err) {
      setError('无法获取系统密钥。');
    }
  };

  if (status === 'LOADING') {
    return (
      <div className="h-screen w-screen bg-[#0f1115] flex flex-col items-center justify-center text-white font-display">
        <div className="relative size-24 mb-8">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Satellite size={32} className="text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-black tracking-[0.4em] uppercase text-primary animate-pulse">Initializing</h2>
        <p className="text-[10px] text-slate-500 font-mono mt-4 uppercase tracking-widest text-center">
          Loading Cloud SDKs...<br/>Checking GEE Auth...
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0f1115] flex flex-col items-center justify-center p-6 text-white font-display">
      <div className="max-w-md w-full bg-[#16181d] border border-[#2d323d] rounded-[40px] p-10 shadow-2xl text-center space-y-8">
        <div className="flex justify-center">
          <div className="size-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary border border-primary/20">
            <Satellite size={40} />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">Satellite Workbench <span className="text-primary font-light">Pro</span></h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            生产级 Earth Engine 数据分析终端
          </p>
        </div>
        <form onSubmit={handleManualConnect} className="space-y-4">
          <input 
            type="text" 
            autoFocus 
            value={manualKey} 
            onChange={(e) => setManualKey(e.target.value)}
            placeholder="输入 Google Cloud API Key"
            className="w-full bg-black/40 border border-[#2d323d] rounded-2xl py-4 px-6 text-sm font-mono focus:border-primary outline-none transition-all"
          />
          {error && <p className="text-rose-500 text-[10px] font-bold uppercase">{error}</p>}
          <button type="submit" className="w-full py-5 bg-primary text-background-dark font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-[1.02] transition-all">启动工作站</button>
        </form>
        <button onClick={handleSystemConnect} className="w-full py-4 bg-white/5 border border-white/10 text-slate-400 font-bold text-[11px] uppercase tracking-widest rounded-2xl">使用默认 Key 登录</button>
      </div>
    </div>
  );
};

root.render(<StartupLauncher />);
