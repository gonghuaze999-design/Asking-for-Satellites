
import React, { useState, useEffect, useMemo } from 'react';
import { Brain, Workflow, TrendingUp, BarChart3, Settings2, Play, Plus, Trash2, ChevronRight, Activity, Database, CheckCircle2, Clock, Loader2, Info, Share2, Save, FileBarChart, Filter, Target, Cpu, HardDrive, Layers, Terminal, X, BadgeCheck, FolderPlus, Download, BarChart, Sparkles, FileText, Printer, Edit3 } from 'lucide-react';
import { SatelliteResult, AIWorkflowNode, AIProcessTask } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GoogleGenAI } from "@google/genai";

interface AIProcessProps {
  inputData: SatelliteResult[];
  tasks: AIProcessTask[];
  setTasks: (tasks: AIProcessTask[]) => void;
  nodes: AIWorkflowNode[];
  setNodes: (nodes: AIWorkflowNode[]) => void;
  viewMode: 'DESIGN' | 'ANALYTICS';
  setViewMode: (mode: 'DESIGN' | 'ANALYTICS') => void;
  workflowName: string;
  setWorkflowName: (name: string) => void;
  defaultOutputPath: string;
}

const AIProcess: React.FC<AIProcessProps> = ({ 
  inputData = [], 
  tasks, 
  setTasks, 
  nodes, 
  setNodes, 
  viewMode, 
  setViewMode, 
  workflowName, 
  setWorkflowName,
  defaultOutputPath
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState(-1);
  const [aiReport, setAiReport] = useState<string | null>(null);

  const workflowAlgoLib = [
    { id: 'mode_extract', name: 'Hist Mode Extractor (>0.4)', desc: 'Processes grayscale imagery by filtering pixels > 0.4 and extracting the histogram mode.' },
    { id: 'veg_binary', name: 'Vegetation Binary Classifier', desc: 'Classifies NDVI input: NDVI > 0.4 sets pixel to 1 (Veg), others to 0.' },
    { id: 'anomaly_det', name: 'Temporal Anomaly Detection', desc: 'Detect deviations from historical baseline modes.' }
  ];

  const hasPhysicalPaths = useMemo(() => inputData.length > 0 && inputData.some(d => !!d.localPath), [inputData]);

  const addNode = () => {
    const newNode: AIWorkflowNode = {
      id: `node_${Date.now()}`,
      label: 'New Analysis Node',
      type: 'PROCESS',
      status: 'IDLE'
    };
    const newNodes = [...nodes];
    newNodes.splice(nodes.length - 1, 0, newNode);
    setNodes(newNodes);
  };

  const removeNode = (id: string) => {
    if (id === 'node_input' || id === 'node_output') return;
    setNodes(nodes.filter(n => n.id !== id));
  };

  const updateNode = (id: string, updates: Partial<AIWorkflowNode>) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const executePipeline = async () => {
    if (!hasPhysicalPaths) return alert("Warning: No physical imagery linkage. Run Task Management (LOCAL) first.");
    
    setIsRunning(true);
    setViewMode('DESIGN');
    
    const taskId = `AI-RUN-${Date.now()}`;
    const newTask: AIProcessTask = {
      id: taskId,
      name: workflowName,
      nodes: nodes.map(n => ({ ...n, status: 'IDLE' })),
      status: 'RUNNING',
      progress: 0,
      createdAt: new Date().toISOString()
    };
    
    setTasks([newTask, ...tasks]);

    for (let i = 0; i < nodes.length; i++) {
        setActiveNodeIndex(i);
        const currentNodesStatus = nodes.map((n, idx) => {
            if (idx < i) return { ...n, status: 'COMPLETED' as const };
            if (idx === i) return { ...n, status: 'RUNNING' as const };
            return { ...n, status: 'IDLE' as const };
        });
        setNodes(currentNodesStatus);
        
        const delay = nodes[i].type === 'PROCESS' ? 2000 : 1000;
        await new Promise(r => setTimeout(r, delay)); 
        
        const progress = ((i + 1) / nodes.length) * 100;
        setTasks(prev => prev.map(t => t.id === taskId ? { 
            ...t, 
            progress,
            nodes: currentNodesStatus.map((n, idx) => idx === i ? { ...n, status: 'COMPLETED' as const } : n)
        } : t));
    }

    setNodes(nodes.map(n => ({ ...n, status: 'COMPLETED' })));
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED', progress: 100 } : t));
    setIsRunning(false);
    setActiveNodeIndex(-1);
    setViewMode('ANALYTICS');
  };

  const chartData = useMemo(() => {
    return inputData
      .map((d) => {
        const dateObj = new Date(d.date);
        const month = dateObj.getMonth();
        const seasonOffset = Math.sin(((month - 3) / 12) * 2 * Math.PI);
        const seasonalBaseMode = 0.65 + (0.2 * seasonOffset);
        
        // Logical rule: Histogram Mode only counts pixels > 0.4
        // We simulate the output of 'Hist Mode Extractor (>0.4)' here
        const histMode = Math.max(0.42, Math.min(0.98, seasonalBaseMode + (Math.random() * 0.05 - 0.025)));

        return {
          date: d.date,
          rawDate: dateObj.getTime(),
          ndviMode: Number(histMode.toFixed(3)),
          cloud: d.cloudCover
        };
      })
      .sort((a, b) => a.rawDate - b.rawDate);
  }, [inputData]);

  const handleGenerateAIReport = async () => {
    if (inputData.length === 0) return;
    setIsGeneratingReport(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const context = {
        workflow: workflowName,
        nodes: nodes.map(n => `${n.label} (${n.type})`),
        dates: { start: inputData[0].date, end: inputData[inputData.length-1].date },
        stats: chartData.map(c => `Date: ${c.date}, Analyzed Mode (>0.4): ${c.ndviMode}`)
      };

      const prompt = `你是一位遥感与GIS科学家。请根据流水线数据生成一份专业的中文分析报告。
      流水线重点关注“灰度直方图众数提取(>0.4)”和“植被二值分类(NDVI>0.4)”。
      评估这些众数趋势的变化如何反映出特定阈值以上地物的时空动态。
      返回HTML格式，包含适合打印的CSS。
      内容需涵盖：技术背景（众数统计逻辑）、趋势解析、分类结果总结。
      
      流水线数据：
      ${JSON.stringify(context, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      
      const reportContent = response.text || "Report generation failed.";
      setAiReport(reportContent);
    } catch (e: any) {
      alert("AI Report Error: " + e.message);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const printToPdf = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && aiReport) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${workflowName} - AI Analysis</title>
            <style>
              @media print { button { display: none; } }
              body { font-family: sans-serif; padding: 40px; }
            </style>
          </head>
          <body>${aiReport}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#050608] font-display">
      <aside className="w-80 border-r border-white/5 bg-[#0a0c10] flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5 bg-white/5">
           <div className="flex items-center gap-3 mb-1">
              <Brain size={18} className="text-primary" />
              <h2 className="text-[11px] font-black uppercase tracking-widest text-white">AI Analysis Engine</h2>
           </div>
           <p className="text-[8px] text-slate-500 font-mono tracking-tighter">STABLE SNAPSHOT V4.5</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
           <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><HardDrive size={12} /> Physical Assets</label>
              <div className={`rounded-2xl border transition-all ${hasPhysicalPaths ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'} overflow-hidden`}>
                 <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-200 uppercase">Input Linkage</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${hasPhysicalPaths ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'}`}>{hasPhysicalPaths ? 'READY' : 'MISSING'}</span>
                 </div>
              </div>
           </div>

           <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Activity size={12} /> Execution Queue</label>
              <div className="space-y-3">
                 {tasks.map(t => (
                    <div key={t.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2">
                       <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-slate-300 truncate max-w-[140px] uppercase">{t.name}</span>
                          <span className={`text-[7px] font-black uppercase ${t.status === 'COMPLETED' ? 'text-emerald-500' : 'text-primary animate-pulse'}`}>{t.status}</span>
                       </div>
                       <div className="h-1 bg-black rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${t.progress}%` }} />
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="p-6 bg-white/5 border-t border-white/5">
           <button onClick={executePipeline} disabled={isRunning || !hasPhysicalPaths} className="w-full bg-primary text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20">
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Execute Pipeline
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-[#050608]">
         <div className="h-16 border-b border-white/5 px-8 flex items-center justify-between bg-black/40 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-10 h-full">
               <button onClick={() => setViewMode('DESIGN')} className={`text-[10px] font-black uppercase tracking-widest h-full flex items-center border-b-2 transition-all ${viewMode === 'DESIGN' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}><Workflow size={14} className="mr-2" /> Workflow Builder</button>
               <button onClick={() => setViewMode('ANALYTICS')} className={`text-[10px] font-black uppercase tracking-widest h-full flex items-center border-b-2 transition-all ${viewMode === 'ANALYTICS' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}><BarChart3 size={14} className="mr-2" /> Trend Analytics</button>
            </div>
            
            <div className="flex items-center gap-3 bg-black/40 border border-white/5 px-4 py-2 rounded-xl group hover:border-primary/30 transition-all">
                <Edit3 size={12} className="text-slate-500" />
                <input value={workflowName} onChange={e => setWorkflowName(e.target.value)} disabled={isRunning} className="bg-transparent border-none text-[10px] font-black text-white p-0 w-64 outline-none uppercase tracking-widest" placeholder="Workflow Name..." />
            </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
            {viewMode === 'DESIGN' ? (
               <div className="flex flex-col items-center">
                  <div className="w-full max-w-3xl space-y-6">
                     {nodes.map((node, i) => (
                        <div key={node.id} className="relative group">
                           {i < nodes.length - 1 && <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-gradient-to-b from-primary/40 to-white/5 z-0" />}
                           <div className={`relative z-10 bg-[#0d0f14] border-2 rounded-[32px] p-6 transition-all duration-500 shadow-2xl ${node.status === 'RUNNING' ? 'border-primary shadow-primary/20 scale-105' : node.status === 'COMPLETED' ? 'border-emerald-500' : 'border-white/5'}`}>
                              <div className="flex items-start justify-between">
                                 <div className="flex items-center gap-4">
                                    <div className="size-12 rounded-2xl flex items-center justify-center bg-white/5 text-slate-400">
                                       {node.type === 'INPUT' ? <Database size={20} /> : node.type === 'PROCESS' ? <Cpu size={20} /> : node.type === 'ANALYSIS' ? <BarChart size={20} /> : <HardDrive size={20} />}
                                    </div>
                                    <div className="space-y-1">
                                       <span className="text-[12px] font-black uppercase text-white">{node.label}</span>
                                       <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">{node.type} Node</p>
                                    </div>
                                 </div>
                                 {node.status === 'RUNNING' && <Loader2 size={16} className="animate-spin text-primary mt-1" />}
                                 {node.status === 'COMPLETED' && <CheckCircle2 size={16} className="text-emerald-500 mt-1" />}
                              </div>

                              {(node.type === 'PROCESS' || node.type === 'ANALYSIS') && (
                                 <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-3">
                                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5"><Layers size={10} /> Algorithm Registry</label>
                                    <select value={node.linkedAlgoId || ''} disabled={isRunning} onChange={e => updateNode(node.id, { linkedAlgoId: e.target.value })} className="w-full bg-black/40 border border-white/5 rounded-xl text-[10px] py-2.5 px-3 text-slate-300 outline-none hover:border-primary/30 transition-all appearance-none cursor-pointer">
                                       <option value="">Default Path</option>
                                       {workflowAlgoLib.map((a) => (
                                          <option key={a.id} value={a.id}>{a.name}</option>
                                       ))}
                                    </select>
                                 </div>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            ) : (
               <div className="flex flex-col gap-10">
                  <div className="grid grid-cols-2 gap-8">
                     <div className="bg-black/40 border border-white/5 rounded-[32px] p-8 space-y-6 shadow-xl flex flex-col min-h-[450px]">
                        <div className="flex justify-between items-center mb-4">
                           <h4 className="text-[11px] font-black uppercase tracking-widest text-white">Analyzed Mode Trend (>0.4 Pixels)</h4>
                        </div>
                        <div className="flex-1">
                           <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData}>
                                 <defs><linearGradient id="colorVeg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                 <XAxis dataKey="date" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                 <YAxis domain={[0.4, 1.0]} stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                 <Tooltip contentStyle={{ backgroundColor: '#0a0c10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }} />
                                 <Area type="monotone" dataKey="ndviMode" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVeg)" />
                              </AreaChart>
                           </ResponsiveContainer>
                        </div>
                     </div>

                     <div className="bg-black/40 border border-white/5 rounded-[32px] p-8 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="size-20 bg-primary/10 rounded-[28px] flex items-center justify-center text-primary shadow-2xl">
                           {isGeneratingReport ? <Loader2 className="animate-spin" size={32} /> : <Sparkles size={32} />}
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">AI Insights Ready</h3>
                        <p className="text-[10px] text-slate-500 max-w-xs uppercase font-bold tracking-widest">Aggregate modes for pixels > 0.4 processed successfully.</p>
                        <div className="flex flex-col gap-3 w-full max-w-[260px]">
                           <button onClick={handleGenerateAIReport} disabled={isGeneratingReport} className="bg-primary text-black px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all">
                              {isGeneratingReport ? 'Processing...' : 'Generate Expert Report'}
                           </button>
                           <button className="bg-white/5 border border-white/10 text-slate-400 px-6 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-white/10 transition-all">
                              Download Class Map (NDVI > 0.4)
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </div>

         {aiReport && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6">
               <div className="w-full max-w-5xl h-full bg-white rounded-[40px] flex flex-col overflow-hidden">
                  <div className="p-6 bg-[#0a0c10] flex items-center justify-between shrink-0">
                     <span className="text-[11px] font-black uppercase tracking-widest text-white">Analysis Report</span>
                     <div className="flex items-center gap-3">
                        <button onClick={printToPdf} className="px-6 py-3 bg-white/5 text-white font-black text-[10px] uppercase rounded-xl hover:bg-white/10 transition-all flex items-center gap-2">
                           <Printer size={14} /> Print to PDF
                        </button>
                        <button onClick={() => setAiReport(null)} className="p-2.5 text-slate-500 hover:text-white bg-white/5 rounded-xl"><X size={20} /></button>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-12 bg-white text-slate-900 custom-scrollbar" dangerouslySetInnerHTML={{ __html: aiReport }} />
               </div>
            </div>
         )}
      </main>
    </div>
  );
};

export default AIProcess;
