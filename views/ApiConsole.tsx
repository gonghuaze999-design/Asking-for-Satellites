
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ShieldAlert, Cpu, Activity, Send, Loader2, Clipboard, Zap, RefreshCw } from 'lucide-react';
import { LogEntry } from '../types';
import { GoogleGenAI } from "@google/genai";
import { SentinelService } from '../services/SentinelService';

interface ApiConsoleProps {
  logs: LogEntry[];
  addLog: (level: any, msg: string, payload?: any) => void;
}

const ApiConsole: React.FC<ApiConsoleProps> = ({ logs, addLog }) => {
  const [input, setInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [systemState, setSystemState] = useState(SentinelService.getState());
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    const timer = setInterval(() => setSystemState(SentinelService.getState()), 2000);
    return () => clearInterval(timer);
  }, []);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const cmd = input;
    setInput('');
    addLog('DEBUG', `UPLINK_TO_GEMINI: ${cmd}`);
    setIsAiProcessing(true);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: cmd,
        config: { systemInstruction: "You are the GEE Workbench System Architect. Answer technical issues directly." }
      });
      addLog('INFO', response.text || 'Command Processed.');
    } catch (err) {
      addLog('ERROR', 'AI_ENGINE_UPLINK_FAILURE');
    } finally {
      setIsAiProcessing(false);
    }
  };

  const generateDiagnosticReport = () => {
    // Fix: Updated call to existing method name in SentinelService
    const report = SentinelService.generateFixPromptForAI();
    navigator.clipboard.writeText(report);
    addLog('SUCCESS', 'DIAGNOSTIC_REPORT_COPIED_TO_CLIPBOARD. PLEASE SEND TO DEVELOPER AI.');
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#050608]">
      <div className="flex-1 flex flex-col p-8 space-y-6 overflow-hidden">
        
        {/* System Health Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-panel-dark/50 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${systemState.geeInitialized ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
              <Cpu size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Core Engine</p>
              <p className="text-xs font-bold">{systemState.geeInitialized ? 'NOMINAL' : 'AWAITING_INIT'}</p>
            </div>
          </div>
          <div className="bg-panel-dark/50 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${systemState.networkStatus === 'STABLE' ? 'bg-primary/10 text-primary' : 'bg-rose-500/10 text-rose-500'}`}>
              <Activity size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Network Link</p>
              <p className="text-xs font-bold">{systemState.networkStatus}</p>
            </div>
          </div>
          <button onClick={generateDiagnosticReport} className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 hover:bg-primary/20 transition-all text-left group">
            <div className="p-3 rounded-xl bg-primary text-black">
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="text-[9px] font-black text-primary uppercase tracking-widest group-hover:animate-pulse">Generate Fix Instruction</p>
              <p className="text-[10px] text-slate-400">Copy AI Diagnostic Pack</p>
            </div>
          </button>
        </div>

        <div className="flex-1 bg-black/60 border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
          
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Terminal size={14} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">SENTINEL_LOG_FEED</span>
            </div>
          </div>

          <div className="flex-1 p-6 font-mono text-[11px] overflow-y-auto custom-scrollbar space-y-2 leading-relaxed">
            {logs.concat(SentinelService.getHistory()).map((log, idx) => (
              <div key={idx} className="flex gap-4 group">
                <span className="text-slate-700 shrink-0">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                <span className={`font-black shrink-0 w-16 ${
                  log.level === 'ERROR' ? 'text-rose-500' : 
                  log.level === 'SUCCESS' ? 'text-emerald-500' : 
                  log.level === 'DEBUG' ? 'text-amber-500' : 'text-primary'
                }`}>{log.level}</span>
                <span className="text-slate-300 group-hover:text-white transition-colors">{log.message}</span>
              </div>
            ))}
            {isAiProcessing && <div className="flex items-center gap-2 text-primary animate-pulse"><RefreshCw size={12} className="animate-spin" /><span>ANALYZING_SYSTEM_STATE...</span></div>}
            <div ref={logEndRef} />
          </div>

          <form onSubmit={handleCommand} className="bg-black/80 p-6 border-t border-white/5 flex items-center gap-4">
            <span className="text-primary font-black text-[10px]">UPLINK {'>'}</span>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-xs text-slate-200 font-mono" 
              placeholder="Query Coprocessor or execute debug command..." 
            />
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApiConsole;
