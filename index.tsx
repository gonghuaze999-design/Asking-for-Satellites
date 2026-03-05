import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Satellite, Loader2, ChevronRight, ShieldAlert } from 'lucide-react';
import { GeeService } from './services/GeeService';

const APP_VERSION = "v2.0.0";

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root element not found");
const root = ReactDOM.createRoot(rootElement);

const StartupLauncher = () => {
  const [projectId, setProjectId] = useState(localStorage.getItem('PROJECT_ID') || 'projects/gee-satellite-app-483808');
  const [status, setStatus] = useState<'IDLE' | 'LOADING'>('IDLE');
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async () => {
    if (!projectId.trim()) { setError('Please enter a Project ID.'); return; }
    setStatus('LOADING');
    setError(null);
    try {
      localStorage.setItem('PROJECT_ID', projectId.trim());
      await GeeService.authenticateManual('', projectId.trim());
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
          <p className="mt-3 text-[11px] text-slate-500">GEE Backend · Service Account · No VPN Required</p>
        </div>
        <div className="w-full bg-[#0a0c10] border border-white/10 rounded-[32px] p-8 shadow-2xl">
          <div className="flex flex-col gap-1 mb-6">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">GCP Project ID</label>
            <input value={projectId} onChange={e => setProjectId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLaunch()} placeholder="projects/your-project-id" className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono text-slate-300 outline-none focus:border-primary/50 transition-all" />
          </div>
          {error && (
            <div className="mb-6 p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-start gap-3">
              <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-rose-300/80 font-mono leading-relaxed">{error}</p>
            </div>
          )}
          <button onClick={handleLaunch} disabled={status === 'LOADING' || !projectId.trim()} className="w-full bg-white hover:bg-primary text-black font-black text-xs uppercase tracking-[0.2em] py-4 rounded-xl transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-2">
            {status === 'LOADING' ? <><Loader2 className="animate-spin" size={16} /> Connecting...</> : <>Launch Mission Control <ChevronRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
};

root.render(<StartupLauncher />);
