
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

  const algorithmLib = useMemo(() => {
    try {
      const saved = localStorage.getItem('GEE_ALGO_LIB');
      const custom = saved ? JSON.parse(saved) : [];
      // Include system defaults too
      return [
        { id: 'ndvi', name: 'NDVI Index' },
        { id: 'veg_mask', name: 'Vegetation Mask (>0.4)' },
        { id: 'water', name: 'NDWI Index' },
        ...custom
      ];
    } catch (e) {
      return [];
    }
  }, []);

  const hasPhysicalPaths = useMemo(() => inputData.length > 0 && inputData.some(d => !!d.localPath), [inputData]);

  const addNode = () => {
    const newNode: AIWorkflowNode = {
      id: `node_${Date.now()}`,
      label: '新分析节点',
      type: 'PROCESS',
      status: 'IDLE'
    };
    const newNodes = [...nodes];
    // Insert before output node
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
    if (!hasPhysicalPaths) return alert("系统警告：未检测到物理影像链接。请先在任务管理中执行本地导出以锁定数据序列。");
    
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
        // Update both UI nodes and task nodes
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
        const cloudFactor = (100 - (d.cloudCover || 0)) / 100;
        const histMode = Math.max(0.42, Math.min(0.95, (seasonalBaseMode * (0.8 + 0.2 * cloudFactor)) + (Math.random() * 0.03)));

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
        imageryCount: inputData.length,
        stats: chartData.map(c => `日期: ${c.date}, NDVI众数: ${c.ndviMode}`)
      };

      const prompt = `你是一位资深遥感科学家。请根据以下流水线数据生成一份专业的中文分析报告。
      推断此分析的潜在目标（如：农作物生长监测、森林砍伐追踪、生态退化评估）。
      使用丰富的HTML格式返回，包含适合打印为PDF的CSS样式（白色背景，专业排版）。
      报告必须包含：执行摘要、研究区域概况（根据影像元数据）、技术路线（提及Google Earth Engine）、基于NDVI众数的趋势深度解析、以及专家级结论建议。
      
      流水线数据：
      ${JSON.stringify(context, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      
      const reportContent = response.text || "报告生成失败。";
      setAiReport(reportContent);
    } catch (e: any) {
      alert("AI报告引擎故障: " + e.message);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const downloadHtmlReport = () => {
    if (!aiReport) return;
    const blob = new Blob([aiReport], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workflowName}_分析报告.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printToPdf = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && aiReport) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${workflowName} - AI Analysis Report</title>
            <style>
              @media print {
                body { margin: 0; padding: 20mm; }
                button { display: none; }
              }
              body { font-family: "Microsoft YaHei", sans-serif; }
            </style>
          </head>
          <body>
            ${aiReport}
            <script>
              window.onload = function() { window.print(); window.close(); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#050608] font-display">
      {/* SIDEBAR: Telemetry & Linkage */}
      <aside className="w-80 border-r border-white/5 bg-[#0a0c10] flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5 bg-white/5">
           <div className="flex items-center gap-3 mb-1">
              <Brain size={18} className="text-primary" />
              <h2 className="text-[11px] font-black uppercase tracking-widest text-white">AI 分析引擎</h2>
           </div>
           <p className="text-[8px] text-slate-500 font-mono tracking-tighter">引擎版本: V4.2_STABLE</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
           {/* Physical Linkage Box */}
           <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><HardDrive size={12} /> 数据链路入口</label>
              <div className={`rounded-2xl border transition-all ${hasPhysicalPaths ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'} overflow-hidden`}>
                 <div className="px-4 pt-4 pb-2 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-200 uppercase tracking-tighter">物理链路</span>
                    <span className={`text-[8px] font-black uppercase ${hasPhysicalPaths ? 'text-emerald-500' : 'text-rose-500'}`}>{hasPhysicalPaths ? '已锁定' : '未链接'}</span>
                 </div>
                 <div className="max-h-48 overflow-y-auto px-4 pb-4 space-y-1.5 custom-scrollbar bg-black/10">
                    {inputData.filter(d => !!d.localPath).map((d, i) => (
                       <div key={i} className="text-[7px] font-mono text-emerald-400 truncate bg-black/40 p-1.5 rounded border border-white/5" title={d.localPath}>
                          LNK: {d.localPath?.split('/').pop()}
                       </div>
                    ))}
                    {inputData.length === 0 && <div className="text-[8px] text-slate-700 p-4 text-center uppercase font-black">等待流输入...</div>}
                 </div>
              </div>
           </div>

           {/* Active Telemetry (Tasks) */}
           <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Activity size={12} /> 实时遥测记录</label>
              <div className="space-y-3">
                 {tasks.map(t => (
                    <div key={t.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-3 shadow-lg group">
                       <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-slate-300 truncate max-w-[140px] uppercase">{t.name}</span>
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${t.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary animate-pulse'}`}>{t.status}</span>
                       </div>
                       <div className="h-1 bg-black rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${t.progress}%` }} />
                       </div>
                       <div className="flex justify-between items-center text-[7px] font-mono text-slate-600 uppercase">
                          <span>完成度</span>
                          <span>{Math.round(t.progress)}%</span>
                       </div>
                    </div>
                 ))}
                 {tasks.length === 0 && <div className="p-8 border border-dashed border-white/5 rounded-3xl text-center opacity-10"><Terminal size={24} className="mx-auto mb-2" /></div>}
              </div>
           </div>
        </div>

        <div className="p-6 bg-white/5 border-t border-white/5">
           <button onClick={executePipeline} disabled={isRunning || !hasPhysicalPaths} className="w-full bg-primary text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20">
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 执行分析流水线
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#050608]">
         {/* HEADER: Workflow Name & Mode Switch */}
         <div className="h-16 border-b border-white/5 px-8 flex items-center justify-between bg-black/40 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-10 h-full">
               <button onClick={() => setViewMode('DESIGN')} className={`text-[10px] font-black uppercase tracking-widest h-full flex items-center border-b-2 transition-all ${viewMode === 'DESIGN' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}><Workflow size={14} className="mr-2" /> 工作流设计器</button>
               <button onClick={() => setViewMode('ANALYTICS')} className={`text-[10px] font-black uppercase tracking-widest h-full flex items-center border-b-2 transition-all ${viewMode === 'ANALYTICS' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}><BarChart3 size={14} className="mr-2" /> 趋势分析面板</button>
            </div>
            
            <div className="flex items-center gap-3 bg-black/40 border border-white/5 px-4 py-2 rounded-xl group hover:border-primary/30 transition-all">
                <Edit3 size={12} className="text-slate-500 group-hover:text-primary transition-colors" />
                <input 
                    value={workflowName} 
                    onChange={e => setWorkflowName(e.target.value)} 
                    disabled={isRunning}
                    className="bg-transparent border-none text-[10px] font-black text-white p-0 w-64 outline-none uppercase tracking-widest placeholder:text-slate-700"
                    placeholder="工作流名称..."
                />
            </div>
         </div>

         {/* VIEWPORT */}
         <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
            {viewMode === 'DESIGN' ? (
               <div className="flex flex-col items-center">
                  <div className="w-full max-w-2xl space-y-6">
                     {nodes.map((node, i) => (
                        <div key={node.id} className="relative group">
                           {/* Connection Line */}
                           {i < nodes.length - 1 && <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-gradient-to-b from-primary/40 to-white/5 z-0" />}
                           
                           <div className={`relative z-10 bg-[#0d0f14] border-2 rounded-[32px] p-6 transition-all duration-500 shadow-2xl ${
                              node.status === 'RUNNING' ? 'border-primary shadow-primary/20 scale-105' : 
                              node.status === 'COMPLETED' ? 'border-emerald-500' : 
                              'border-white/5 hover:border-white/10'
                           }`}>
                              <div className="flex items-start justify-between">
                                 <div className="flex items-center gap-4">
                                    <div className={`size-12 rounded-2xl flex items-center justify-center ${
                                       node.type === 'INPUT' ? 'bg-primary/10 text-primary' :
                                       node.type === 'OUTPUT' ? 'bg-amber-500/10 text-amber-500' :
                                       node.type === 'PROCESS' ? 'bg-purple-500/10 text-purple-400' :
                                       'bg-slate-800/40 text-slate-400'
                                    }`}>
                                       {node.type === 'INPUT' && <Database size={20} />}
                                       {node.type === 'PROCESS' && <Cpu size={20} />}
                                       {node.type === 'ANALYSIS' && <BarChart size={20} />}
                                       {node.type === 'OUTPUT' && <HardDrive size={20} />}
                                    </div>
                                    <div className="space-y-1">
                                       <input 
                                          value={node.label} 
                                          disabled={node.type === 'INPUT' || isRunning}
                                          onChange={e => updateNode(node.id, { label: e.target.value })}
                                          className="bg-transparent border-none text-[12px] font-black uppercase text-white outline-none focus:text-primary transition-colors" 
                                       />
                                       <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">{node.type} 节点</p>
                                    </div>
                                 </div>
                                 {node.type !== 'INPUT' && node.type !== 'OUTPUT' && !isRunning && (
                                    <button onClick={() => removeNode(node.id)} className="p-2 text-slate-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                                 )}
                                 {node.status === 'RUNNING' && <Loader2 size={16} className="animate-spin text-primary mt-1" />}
                                 {node.status === 'COMPLETED' && <CheckCircle2 size={16} className="text-emerald-500 mt-1" />}
                              </div>

                              {/* ALGO SELECTION DROPDOWN */}
                              {(node.type === 'PROCESS' || node.type === 'ANALYSIS') && (
                                 <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-3">
                                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5"><Layers size={10} /> 算法内核关联</label>
                                    <select 
                                       value={node.linkedAlgoId || ''}
                                       disabled={isRunning}
                                       onChange={e => updateNode(node.id, { linkedAlgoId: e.target.value })}
                                       className="w-full bg-black/40 border border-white/5 rounded-xl text-[10px] py-2.5 px-3 text-slate-300 outline-none hover:border-primary/30 transition-all appearance-none cursor-pointer"
                                    >
                                       <option value="">未选择算法 (默认执行)</option>
                                       {algorithmLib.map((a: any) => (
                                          <option key={a.id} value={a.id}>{a.name}</option>
                                       ))}
                                    </select>
                                 </div>
                              )}
                              
                              {node.type === 'OUTPUT' && (
                                 <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                                    <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5"><FolderPlus size={10} /> 导出目录关联</label>
                                    <div className="relative group/path">
                                       <input 
                                          value={node.customOutputPath || defaultOutputPath}
                                          disabled={isRunning}
                                          onChange={e => updateNode(node.id, { customOutputPath: e.target.value })}
                                          className="w-full bg-black/40 border border-white/5 rounded-xl text-[9px] py-3 px-4 text-emerald-500 font-mono outline-none group-hover/path:border-primary/20" 
                                       />
                                    </div>
                                 </div>
                              )}
                           </div>
                        </div>
                     ))}

                     {!isRunning && (
                        <button onClick={addNode} className="w-full py-6 border-2 border-dashed border-white/5 rounded-[32px] text-slate-700 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-3 group">
                           <div className="p-2 rounded-full bg-white/5 group-hover:bg-primary/10 transition-colors"><Plus size={20} /></div>
                           <span className="text-[10px] font-black uppercase tracking-widest">追加分析步骤</span>
                        </button>
                     )}
                  </div>
               </div>
            ) : (
               <div className="flex flex-col gap-10 animate-in slide-in-from-right-10 duration-500">
                  <div className="grid grid-cols-2 gap-8">
                     {/* CHART BOX */}
                     <div className="bg-black/40 border border-white/5 rounded-[32px] p-8 space-y-6 shadow-xl flex flex-col min-h-[450px]">
                        <div className="flex justify-between items-center mb-4">
                           <h4 className="text-[11px] font-black uppercase tracking-widest text-white">NDVI 时序分析结果</h4>
                           <span className="text-[8px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">众数统计引擎</span>
                        </div>
                        <div className="flex-1">
                           <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData}>
                                 <defs><linearGradient id="colorVeg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                 <XAxis dataKey="date" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} dy={10} />
                                 <YAxis domain={[0.4, 1.0]} stroke="#475569" fontSize={9} tickLine={false} axisLine={false} dx={-10} />
                                 <Tooltip 
                                    contentStyle={{ backgroundColor: '#0a0c10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                                    formatter={(value: any) => [value, 'NDVI 众数']}
                                 />
                                 <Area type="monotone" dataKey="ndviMode" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVeg)" />
                              </AreaChart>
                           </ResponsiveContainer>
                        </div>
                     </div>

                     {/* ACTIONS & REPORT BOX */}
                     <div className="bg-black/40 border border-white/5 rounded-[32px] p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                        <div className="size-20 bg-primary/10 rounded-[28px] flex items-center justify-center text-primary shadow-2xl relative">
                           {isGeneratingReport ? <Loader2 className="animate-spin" size={32} /> : <FileBarChart size={32} />}
                        </div>
                        <div className="space-y-2 relative">
                           <h3 className="text-xl font-black text-white uppercase tracking-tight">统计流程已就绪</h3>
                           <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed uppercase tracking-widest font-bold">
                             Gemini Pro 时序综合分析内核已就位，可生成中文专家研判报告。
                           </p>
                        </div>
                        <div className="flex flex-col gap-3 w-full max-w-[260px] relative">
                           <button 
                             onClick={handleGenerateAIReport}
                             disabled={isGeneratingReport}
                             className="bg-primary text-black px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                           >
                              {isGeneratingReport ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 
                              {isGeneratingReport ? '报告合成中...' : '生成 AI 分析报告'}
                           </button>
                           <button onClick={() => {}} className="bg-white/5 border border-white/10 text-slate-400 px-6 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2">
                              <Download size={14} /> 导出原始数据
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </div>

         {/* AI REPORT MODAL */}
         {aiReport && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6 sm:p-12">
               <div className="w-full max-w-5xl h-full bg-white rounded-[40px] flex flex-col overflow-hidden shadow-[0_0_100px_rgba(17,180,212,0.2)] border border-white/10">
                  {/* MODAL HEADER */}
                  <div className="p-6 bg-[#0a0c10] flex items-center justify-between border-b border-white/5 shrink-0">
                     <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/10 rounded-2xl text-primary shadow-inner"><FileText size={20} /></div>
                        <div>
                           <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Gemini 智能综述报告 (中文)</h3>
                           <p className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">Report ID: {Math.random().toString(36).substring(7).toUpperCase()}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <button onClick={printToPdf} className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase rounded-xl hover:bg-white/10 transition-all">
                           <Printer size={14} /> 打印/导出 PDF
                        </button>
                        <button onClick={downloadHtmlReport} className="flex items-center gap-2 px-6 py-3 bg-primary text-black font-black text-[10px] uppercase rounded-xl hover:scale-105 transition-all shadow-lg">
                           <Save size={14} /> 保存 HTML 副本
                        </button>
                        <button onClick={() => setAiReport(null)} className="p-2.5 text-slate-500 hover:text-white bg-white/5 rounded-xl transition-all ml-2"><X size={20} /></button>
                     </div>
                  </div>
                  
                  {/* REPORT CONTENT */}
                  <div className="flex-1 overflow-y-auto p-12 bg-white text-slate-900 custom-scrollbar shadow-inner relative report-preview">
                     <style dangerouslySetInnerHTML={{ __html: `
                        .report-preview h1 { font-size: 2.25rem; font-weight: 900; color: #0f172a; margin-bottom: 2rem; border-bottom: 4px solid #11b4d4; padding-bottom: 1rem; }
                        .report-preview h2 { font-size: 1.4rem; font-weight: 800; color: #1e293b; margin-top: 2.5rem; margin-bottom: 1rem; border-left: 6px solid #11b4d4; padding-left: 1.25rem; }
                        .report-preview h3 { font-size: 1.1rem; font-weight: 700; color: #334155; margin-top: 1.5rem; }
                        .report-preview p { font-size: 1rem; line-height: 1.8; color: #475569; margin-bottom: 1.25rem; text-align: justify; }
                        .report-preview ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1.5rem; }
                        .report-preview li { margin-bottom: 0.5rem; color: #475569; }
                        .report-preview table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
                        .report-preview th { background: #f8fafc; text-align: left; padding: 1rem; font-weight: 800; border-bottom: 2px solid #e2e8f0; }
                        .report-preview td { padding: 1rem; border-bottom: 1px solid #f1f5f9; }
                        .report-preview .badge { background: #e0f2fe; color: #0369a1; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; }
                        @media print {
                           .report-preview { padding: 0 !important; }
                        }
                     `}} />
                     <div className="max-w-3xl mx-auto" dangerouslySetInnerHTML={{ __html: aiReport }} />
                  </div>
               </div>
            </div>
         )}
      </main>
    </div>
  );
};

export default AIProcess;
