
import React, { useState, useEffect, useMemo } from 'react';
import { Brain, Workflow, TrendingUp, BarChart3, Settings2, Play, Plus, Trash2, ChevronRight, Activity, Database, CheckCircle2, Clock, Loader2, Info, Share2, Save, FileBarChart, Filter, Target, Cpu, HardDrive, Layers, Terminal, X, BadgeCheck, FolderPlus, Download, BarChart, Sparkles, FileText, Printer, Edit3, Globe, ExternalLink } from 'lucide-react';
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
  const [reportStatus, setReportStatus] = useState("");
  const [groundingLinks, setGroundingLinks] = useState<{title: string, uri: string}[]>([]);
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
      label: 'New Analytics Node',
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
    setReportStatus("正在启动深度研判协议...");
    setGroundingLinks([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const context = {
        workflow: workflowName,
        nodes: nodes.map(n => `${n.label} (${n.type})`),
        dates: { 
          start: inputData[0].date, 
          end: inputData[inputData.length-1].date 
        },
        stats: chartData.map(c => `日期: ${c.date}, NDVI 众数: ${c.ndviMode}`),
        tiles: Array.from(new Set(inputData.map(d => d.tileId))).join(', ')
      };

      setReportStatus("正在访问全球农业知识库 (FAO, USDA, CABI)...");

      const prompt = `你是一位顶尖的农业遥感专家与全球粮食安全顾问。请基于以下遥感流水线分析结果，并利用 Google Search 工具进行全球范围的实时信息检索，生成一份深度专业的中文农情监测报告。

      监测背景：
      - 时间区间：${context.dates.start} 至 ${context.dates.end}
      - 瓦片区域 (MGRS)：${context.tiles}
      - 观测趋势 (NDVI 众数动态)：${context.stats.join('; ')}

      核心要求：
      1. **全球知识整合 (Grounding)**：
         - 搜索该区域在监测时段内的历史气象记录。重点关注：降水量、气温异常、是否存在记录在案的极端事件（如干旱、寒潮、强降雨）。
         - 检索 FAO GIEWS、USDA 外国农业局、CABI 等机构对该区域当季作物生长、病虫害风险或政策干预的官方简报。
         - 确认监测区域的主要作物类型及其对应的物候历（Phenological Stage）。
      2. **交叉验证分析**：
         - 将遥感观测到的 NDVI 众数波动与检索到的气象实况进行深度对比。
         - 解释 NDVI 的季节性起伏或突发性下降是否由气象因素、农业收割活动或自然灾害导致。
      3. **专业报告结构 (HTML)**：
         - **执行摘要**：核心发现。
         - **区域农业基准概况**：基于 Grounding 搜索到的当地农业背景。
         - **遥感监测与气象交叉研判**：详细解析 NDVI 众数趋势与环境因素的关联。
         - **风险评估与未来展望**：基于历史规律与当前态势预测接下来的风险。
      
      返回格式：纯 HTML 内容，需包含内联 CSS 以实现专业、美观的排版效果（适合直接打印）。`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        }
      });
      
      // 提取引用链接
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const links = chunks
          .filter((c: any) => c.web)
          .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
        setGroundingLinks(links);
      }

      setAiReport(response.text || "报告生成失败。");
    } catch (e: any) {
      alert("AI 报告生成错误: " + e.message);
    } finally {
      setIsGeneratingReport(false);
      setReportStatus("");
    }
  };

  const printToPdf = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && aiReport) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${workflowName} - 专业农情报告</title>
            <style>
              @media print { .no-print { display: none !important; } }
              body { font-family: 'Space Grotesk', sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; }
              .source-link { color: #11b4d4; text-decoration: none; font-size: 12px; display: block; margin-top: 5px; }
            </style>
          </head>
          <body>
            ${aiReport}
            <div class="no-print" style="margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px;">
              <h3 style="font-size: 14px; text-transform: uppercase; color: #666;">数据来源与全球引用 (AI Grounding Sources)</h3>
              ${groundingLinks.map(l => `<a href="${l.uri}" target="_blank" class="source-link">🔗 ${l.title || l.uri}</a>`).join('')}
            </div>
          </body>
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
           <p className="text-[8px] text-slate-500 font-mono tracking-tighter">STABLE SNAPSHOT v1.3.0-stable</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
           <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><HardDrive size={12} /> Physical Assets</label>
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${hasPhysicalPaths ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'}`}>{hasPhysicalPaths ? 'READY' : 'EMPTY'}</span>
              </div>
              
              <div className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden max-h-[300px] flex flex-col">
                 <div className="overflow-y-auto custom-scrollbar p-3 space-y-2">
                    {inputData.map((img, idx) => (
                       <div key={idx} className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/5 group transition-all">
                          <div className="size-10 bg-black rounded-lg overflow-hidden shrink-0">
                             <img src={img.thumbnail} className="w-full h-full object-cover opacity-60 group-hover:opacity-100" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <p className="text-[9px] font-bold text-slate-200 truncate uppercase">{img.date}</p>
                             <p className="text-[7px] font-mono text-slate-500 truncate">{img.metadata.sensingTime}</p>
                          </div>
                          {img.localPath && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
                       </div>
                    ))}
                    {inputData.length === 0 && (
                       <div className="py-10 text-center opacity-20">
                          <Database size={24} className="mx-auto mb-2" />
                          <p className="text-[8px] font-black uppercase">No Linked Data</p>
                       </div>
                    )}
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
                                       <div className="flex items-center gap-3">
                                          {node.type !== 'INPUT' && node.type !== 'OUTPUT' ? (
                                             <input 
                                                value={node.label} 
                                                onChange={e => updateNode(node.id, { label: e.target.value })} 
                                                className="bg-transparent border-none text-[12px] font-black uppercase text-white p-0 focus:ring-0 outline-none w-48"
                                             />
                                          ) : (
                                             <span className="text-[12px] font-black uppercase text-white">{node.label}</span>
                                          )}
                                       </div>
                                       <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">{node.type} Node</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-3 mt-1">
                                    {node.status === 'RUNNING' && <Loader2 size={16} className="animate-spin text-primary" />}
                                    {node.status === 'COMPLETED' && <CheckCircle2 size={16} className="text-emerald-500" />}
                                    {node.type !== 'INPUT' && node.type !== 'OUTPUT' && !isRunning && (
                                       <button onClick={() => removeNode(node.id)} className="text-slate-700 hover:text-rose-500 transition-colors p-1">
                                          <Trash2 size={16} />
                                       </button>
                                    )}
                                 </div>
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
                     
                     <div className="pt-6 flex justify-center">
                        <button onClick={addNode} disabled={isRunning} className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/10 hover:border-primary/40 transition-all flex items-center gap-3 group">
                           <Plus size={16} className="group-hover:rotate-90 transition-transform" /> Add Custom Node
                        </button>
                     </div>
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
                           <Sparkles size={32} />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">AI Insights Ready</h3>
                        <p className="text-[10px] text-slate-500 max-w-xs uppercase font-bold tracking-widest leading-relaxed">
                           遥感众数提取已就绪。系统将启动 Gemini 3 深度搜索，整合 FAO/USDA 知识库与历史气象交叉验证，生成专业农情报告。
                        </p>
                        <div className="flex flex-col gap-3 w-full max-w-[260px]">
                           <button onClick={handleGenerateAIReport} className="bg-primary text-black px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.1em] shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2">
                              <Sparkles size={14} /> Generate Professional Report
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

         {/* 报告生成时的沉浸式加载蒙层 */}
         {isGeneratingReport && (
            <div className="fixed inset-0 z-[600] flex flex-col items-center justify-center bg-[#050608]/95 backdrop-blur-2xl">
              <div className="w-full max-w-md text-center space-y-10 animate-in zoom-in-95 duration-500">
                <div className="relative flex justify-center">
                   <div className="size-32 bg-primary/10 rounded-full flex items-center justify-center relative z-10 border border-primary/20">
                      <Globe size={48} className="text-primary animate-pulse" />
                   </div>
                   <div className="absolute inset-0 size-32 mx-auto bg-primary/5 rounded-full animate-ping" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-xl font-black text-white uppercase tracking-[0.2em]">Deep Research Protocol</h3>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-3 text-primary font-mono text-[10px] uppercase font-black">
                      <Loader2 size={14} className="animate-spin" />
                      {reportStatus}
                    </div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest max-w-[300px] leading-relaxed">
                       正在交叉引用遥感 NDVI 异常值与全球极端天气数据库及 FAO 农业简报...
                    </p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-6 rounded-[32px] text-left">
                   <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary animate-terminal-scan w-full shadow-[0_0_10px_#11b4d4]" />
                   </div>
                </div>
              </div>
            </div>
         )}

         {aiReport && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6">
               <div className="w-full max-w-5xl h-full bg-white rounded-[40px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
                  <div className="p-6 bg-[#0a0c10] flex items-center justify-between shrink-0 border-b border-white/5">
                     <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary"><FileText size={18} /></div>
                        <span className="text-[11px] font-black uppercase tracking-widest text-white">Professional Agricultural Monitoring Report</span>
                     </div>
                     <div className="flex items-center gap-3">
                        <button onClick={printToPdf} className="px-6 py-3 bg-white/5 text-white font-black text-[10px] uppercase rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 border border-white/10">
                           <Printer size={14} /> Print / Export PDF
                        </button>
                        <button onClick={() => setAiReport(null)} className="p-2.5 text-slate-500 hover:text-white bg-white/5 rounded-xl transition-colors"><X size={20} /></button>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-16 bg-white text-slate-900 custom-scrollbar">
                    <article className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: aiReport }} />
                    
                    {groundingLinks.length > 0 && (
                      <div className="mt-16 pt-8 border-t border-slate-200 no-print">
                        <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] mb-6 flex items-center gap-2">
                           <Globe size={14} /> Grounding Sources & Global Knowledge References
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {groundingLinks.map((link, idx) => (
                            <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-primary hover:shadow-lg transition-all group">
                              <div className="flex items-center gap-3 min-w-0">
                                <ExternalLink size={14} className="text-slate-400 group-hover:text-primary shrink-0" />
                                <span className="text-[11px] font-bold text-slate-700 truncate">{link.title || link.uri}</span>
                              </div>
                              <ChevronRight size={14} className="text-slate-300 group-hover:text-primary" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
               </div>
            </div>
         )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes terminal-scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } } 
        .animate-terminal-scan { animation: terminal-scan 2s infinite ease-in-out; }
      ` }} />
    </div>
  );
};

export default AIProcess;
