
import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Zap, Activity, Send, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { LogEntry } from '../types';
import { GoogleGenAI } from "@google/genai";

interface ApiConsoleProps {
  logs: LogEntry[];
  addLog: (level: any, msg: string, payload?: any) => void;
}

const ApiConsole: React.FC<ApiConsoleProps> = ({ logs, addLog }) => {
  const [input, setInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const cmd = input;
    setInput('');
    addLog('DEBUG', `发送至 AI 协处理器: ${cmd}`);
    setIsAiProcessing(true);

    const effectiveKey = window.__MANUAL_KEY__ || process.env.API_KEY || '';
    const ai = new GoogleGenAI({ apiKey: effectiveKey });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: cmd,
        config: {
          systemInstruction: "You are a Google Earth Engine expert. Answer technical questions about Earth Engine scripts or satellite data analysis briefly."
        }
      });
      addLog('INFO', response.text || '解析完成。');
    } catch (err) {
      addLog('ERROR', 'AI 引擎响应失败，请检查 API Key。');
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">Terminal & API Console</h2>
            <p className="text-slate-400 text-sm">实时监控 Earth Engine 后端通讯与作业状态。</p>
          </div>
        </div>

        <div className="flex-1 bg-[#090a0d] border border-border-dark rounded-xl overflow-hidden flex flex-col shadow-2xl">
          <div className="bg-panel-dark/50 px-6 py-3 border-b border-border-dark flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal size={14} className="text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Log v4.1</span>
            </div>
          </div>
          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto custom-scrollbar space-y-2">
            {logs.map((log, idx) => (
              <div key={idx} className="animate-in fade-in duration-300">
                <span className="text-slate-600">[{log.timestamp}]</span>{' '}
                <span className={`font-black ${
                  log.level === 'INFO' ? 'text-blue-400' :
                  log.level === 'SUCCESS' ? 'text-emerald-500' :
                  log.level === 'ERROR' ? 'text-rose-500' : 'text-slate-500'
                }`}>{log.level}</span>{' '}
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
            {isAiProcessing && <div className="flex items-center gap-2 text-primary animate-pulse"><Loader2 size={12} className="animate-spin" /><span>Gemini 正在分析请求...</span></div>}
            <div ref={logEndRef} />
          </div>
          <form onSubmit={handleCommand} className="bg-background-dark p-4 border-t border-border-dark flex items-center gap-3">
            <span className="text-primary font-bold">user@gee-workbench:~$</span>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-xs text-slate-300 font-mono" 
              placeholder="询问技术支持或执行命令..." 
            />
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApiConsole;
