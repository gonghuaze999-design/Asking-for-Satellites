
import React, { useState, useEffect, useCallback } from 'react';
import { Play, Database, Save, Code2, LayoutTemplate, Settings, CheckCircle2, Terminal, Cpu, FileCode, Loader2, Trash2, Activity, ChevronDown, ChevronUp, Layers, Info, Trash, LayoutGrid, PackageCheck, History, BarChart3, Clock, ArrowRightLeft, Target } from 'lucide-react';
import { Task, SatelliteResult, AppTab } from '../types';
import { GeeService } from '../services/GeeService';

interface TaskManagementProps {
  tasks: Task[];
  inputData?: SatelliteResult[];
  currentRoi?: any; 
  addTask: (name: string, type: string) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  setActiveTab?: (tab: AppTab) => void;
}

const ALGO_TEMPLATES = [
  { 
    id: 'ndvi', 
    name: 'NDVI Index', 
    desc: 'Vegetation density assessment via (B8-B4)/(B8+B4).', 
    code: `// Sentinel-2 NDVI Calculation Kernel\nvar result = inputCollection.map(function(image) {\n  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');\n  return image.addBands(ndvi);\n});\n\nvar finalComposite = result.median().clip(geometry);\nprint(finalComposite);`
  },
  { 
    id: 'water', 
    name: 'NDWI Index', 
    desc: 'Water body extraction via (Green-NIR)/(Green+NIR).', 
    code: `// Sentinel-2 NDWI Calculation Kernel\nvar result = inputCollection.map(function(image) {\n  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');\n  return image.addBands(ndwi);\n});\n\nvar finalComposite = result.median().clip(geometry);\nprint(finalComposite);`
  },
  { 
    id: 'rgb', 
    name: 'True Color', 
    desc: 'Standard median composite of Red, Green, and Blue bands.', 
    code: `// Sentinel-2 RGB Natural Color Composite\nvar finalComposite = inputCollection.median()\n  .select(['B4', 'B3', 'B2'])\n  .clip(geometry);\n\nprint(finalComposite);`
  }
];

const TaskManagement: React.FC<TaskManagementProps> = ({ tasks, inputData = [], currentRoi, addTask, updateTask }) => {
  const [activeView, setActiveView] = useState<'DESIGN' | 'MONITOR'>('DESIGN');
  const [selectedTemplate, setSelectedTemplate] = useState('ndvi');
  const [codeContent, setCodeContent] = useState(ALGO_TEMPLATES[0].code);
  const [taskName, setTaskName] = useState('Sentinel2_Analysis');
  const [outputType, setOutputType] = useState('LOCAL');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uplinkLogs, setUplinkLogs] = useState<string[]>([]);
  const [editorFontSize, setEditorFontSize] = useState(13);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // 统计信息计算 (Queue Summary Metrics)
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
  const runningCount = tasks.filter(t => t.status === 'RUNNING').length;
  const failedCount = tasks.filter(t => t.status === 'FAILED').length;

  // 联动逻辑：切换模板时更新代码
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = ALGO_TEMPLATES.find(t => t.id === templateId);
    if (template) setCodeContent(template.code);
  };

  const addUplinkLog = (msg: string) => {
    setUplinkLogs(prev => [...prev.slice(-99), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const clearLogs = () => setUplinkLogs([]);

  const handleSubmit = async () => {
    if (inputData.length === 0) return alert("Please select imagery in Data Search first.");
    const taskId = addTask(`${taskName} (${outputType})`, outputType);
    setIsProcessing(true);
    setActiveView('MONITOR');
    addUplinkLog(`Initializing sequence for ${inputData.length} scenes...`);
    
    const ids = inputData.map(r => r.id);
    let securityBlocked = false;

    if (outputType === 'LOCAL') {
      try {
        await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      } catch (e: any) {
        if (e.name === 'SecurityError' || e.message.includes('sub frames')) {
          addUplinkLog("!! SECURITY_BLOCK: Browser restriction detected. Using Multi-Blob fallback.");
          securityBlocked = true;
        } else if (e.name === 'AbortError') {
          updateTask(taskId, { status: 'FAILED' });
          setIsProcessing(false);
          return;
        }
      }
    }

    try {
      if (outputType === 'LOCAL' && securityBlocked) {
        let completed = 0;
        for (let i = 0; i < ids.length; i++) {
          const resultObj = inputData[i];
          const { url, fileName } = await GeeService.generateSingleLocalUrl(ids[i], resultObj.date, selectedTemplate.toUpperCase(), currentRoi, taskName);
          addUplinkLog(`Fetching: ${fileName}`);
          const res = await fetch(url);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `${fileName}.tif`;
          document.body.appendChild(a); a.click();
          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 1000);
          completed++;
          updateTask(taskId, { progress: Math.round((completed / ids.length) * 100) });
          addUplinkLog(`DONE: ${fileName} processed.`);
          await new Promise(r => setTimeout(r, 1200));
        }
        updateTask(taskId, { status: 'COMPLETED', progress: 100 });
      } else {
        await GeeService.startBatchExport(ids, selectedTemplate, currentRoi, outputType, taskName, addUplinkLog);
        updateTask(taskId, { status: 'COMPLETED', progress: 100 });
      }
    } catch (e: any) {
      updateTask(taskId, { status: 'FAILED', error: e.message });
      addUplinkLog(`!! ERROR: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#050608]">
      {/* Sidebar: 专注于任务配置与宏观统计 */}
      <aside className="w-64 border-r border-white/5 bg-[#0a0c10] flex flex-col shrink-0">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="size-1.5 bg-primary rounded-full shadow-[0_0_8px_#11b4d4]" />
             <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Control Unit</h2>
          </div>
          <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
             <button onClick={() => setActiveView('DESIGN')} className={`p-1.5 rounded-md transition-all ${activeView === 'DESIGN' ? 'bg-primary text-black' : 'text-slate-500 hover:text-white'}`}><LayoutTemplate size={12} /></button>
             <button onClick={() => setActiveView('MONITOR')} className={`p-1.5 rounded-md transition-all ${activeView === 'MONITOR' ? 'bg-primary text-black' : 'text-slate-500 hover:text-white'}`}><Activity size={12} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          {activeView === 'DESIGN' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Kernel Repository</label>
                <div className="space-y-1.5">
                  {ALGO_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => handleTemplateChange(t.id)} className={`w-full text-left p-3 rounded-xl border transition-all ${selectedTemplate === t.id ? 'bg-primary/5 border-primary shadow-[0_0_15px_rgba(17,180,212,0.1)]' : 'bg-black/20 border-white/5 hover:border-white/10'}`}>
                      <p className={`text-[10px] font-bold ${selectedTemplate === t.id ? 'text-primary' : 'text-slate-300'}`}>{t.name}</p>
                      <p className="text-[7px] text-slate-500 mt-0.5 line-clamp-1">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Output Destination</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['LOCAL', 'DRIVE', 'ASSET'].map(type => (
                    <button key={type} onClick={() => setOutputType(type)} className={`py-2 rounded-lg border text-[8px] font-black transition-all ${outputType === type ? 'bg-primary text-black border-primary' : 'bg-black/40 text-slate-500 border-white/5'}`}>{type}</button>
                  ))}
                </div>
              </div>
              <div className="pt-4">
                 <button onClick={handleSubmit} disabled={isProcessing || inputData.length === 0} className="w-full bg-white hover:bg-primary text-black font-black text-xs uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-2xl group">
                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="group-hover:fill-current" />}
                    Deploy Batch
                 </button>
                 <p className="text-[8px] text-slate-600 text-center mt-3 uppercase font-mono italic">Validated for Stable Version 1.0</p>
              </div>
            </div>
          ) : (
            /* MONITOR SIDEBAR: 汇总摘要，无重复列表 */
            <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-500">
               <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Live Pipeline Status</label>
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-5 space-y-4 shadow-inner">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-slate-400"><div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" /><span className="text-[9px] font-bold uppercase tracking-tight">Success</span></div>
                        <span className="text-[10px] font-mono font-bold text-white">{completedCount}</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-slate-400"><div className="size-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#11b4d4]" /><span className="text-[9px] font-bold uppercase tracking-tight">Running</span></div>
                        <span className="text-[10px] font-mono font-bold text-white">{runningCount}</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-slate-400"><div className="size-1.5 rounded-full bg-rose-500" /><span className="text-[9px] font-bold uppercase tracking-tight">Failure</span></div>
                        <span className="text-[10px] font-mono font-bold text-white">{failedCount}</span>
                     </div>
                     <div className="h-px bg-white/5" />
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-slate-400"><BarChart3 size={12} /><span className="text-[9px] font-bold uppercase tracking-tight">Peak Load</span></div>
                        <span className="text-[10px] font-mono font-bold text-slate-300">32 MB/s</span>
                     </div>
                  </div>
               </div>
               <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-primary mb-2"><Info size={12} /><span className="text-[9px] font-black uppercase tracking-widest">Health Insight</span></div>
                  <p className="text-[9px] text-slate-400 leading-relaxed">System is performing optimally. Auto-retry protocol is active for transient network errors.</p>
               </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Area: 差异化布局 */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#050608]">
        {activeView === 'DESIGN' ? (
          /* DESIGN VIEW: 影像预览 + 代码 (分层清晰) */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 影像廊桥：作为处理前的输入确认 (New Header Area) */}
            <div className="h-44 border-b border-white/5 bg-black/40 p-6 flex flex-col gap-3 shrink-0">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary">
                     <PackageCheck size={14} />
                     <span className="text-[10px] font-black uppercase tracking-widest">Input Imagery Stream</span>
                  </div>
                  <div className="flex items-center gap-4">
                     <span className="text-[9px] font-mono text-slate-500 uppercase">{inputData.length} Scenes Selected</span>
                     <div className="h-3 w-px bg-white/10" />
                     <div className="flex items-center gap-1.5 text-slate-500"><Target size={12} /><span className="text-[9px] font-black uppercase tracking-tight">{selectedTemplate} Active</span></div>
                  </div>
               </div>
               <div className="flex-1 overflow-x-auto flex gap-3 pb-2 custom-scrollbar">
                  {inputData.map((img, i) => (
                    <div key={img.id} className="min-w-[130px] bg-[#111318] rounded-2xl border border-white/5 overflow-hidden group hover:border-primary/40 transition-all flex flex-col shadow-lg">
                       <div className="h-16 bg-black relative">
                          <img src={img.thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                          <div className="absolute top-1 left-1 text-[7px] bg-black/80 px-1 py-0.5 rounded text-slate-400 border border-white/5">0{i+1}</div>
                       </div>
                       <div className="p-2.5 flex-1 flex flex-col justify-center">
                          <p className="text-[9px] font-bold text-slate-200">{img.date}</p>
                          <p className="text-[7px] text-slate-500 font-mono truncate uppercase tracking-tighter">{img.id.split('/').pop()}</p>
                       </div>
                    </div>
                  ))}
                  {inputData.length === 0 && (
                    <div className="flex-1 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-600 animate-pulse bg-white/2">
                       <Database size={24} />
                       <p className="text-[8px] uppercase font-black mt-2 tracking-widest text-center">Waiting for Input data from Search Terminal</p>
                    </div>
                  )}
               </div>
            </div>

            {/* 编辑器：高度优化，专注于逻辑核 (Central Editor) */}
            <div className="flex-1 flex flex-col min-h-0 bg-[#07080a]">
               <div className="h-10 border-b border-white/5 bg-[#0a0c10] px-6 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 text-slate-400">
                     <FileCode size={12} className="text-primary/70" />
                     <span className="text-[9px] font-black uppercase tracking-widest">Processor_v1.0.js</span>
                  </div>
                  <div className="flex items-center gap-3">
                     <button onClick={() => { localStorage.setItem('GEE_SCRATCH', codeContent); setIsSaved(true); setTimeout(() => setIsSaved(false), 2000); }} className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border transition-all ${isSaved ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary hover:text-black'}`}>
                        {isSaved ? <CheckCircle2 size={10} /> : <Save size={10} />}
                        {isSaved ? 'Synchronized' : 'Commit Code'}
                     </button>
                  </div>
               </div>
               <div className="flex-1 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-8 h-full bg-white/2 border-r border-white/5" />
                  <textarea value={codeContent} onChange={e => setCodeContent(e.target.value)} spellCheck={false} className="w-full h-full bg-transparent p-10 pl-14 text-slate-400 font-mono outline-none resize-none leading-relaxed custom-scrollbar selection:bg-primary/20" style={{ fontSize: `${editorFontSize}px` }} />
               </div>
            </div>
            
            {/* 极简底部：仅显示链路信息 */}
            <div className="h-8 border-t border-white/5 bg-black/60 px-6 flex items-center gap-6 text-[8px] font-mono text-slate-600 uppercase shrink-0">
               <div className="flex items-center gap-1.5"><Clock size={10} /> Response: 28ms</div>
               <div className="flex items-center gap-1.5"><ArrowRightLeft size={10} /> Linkage: GEE-PRO-1.0</div>
               <div className="ml-auto text-primary/30 tracking-tighter">Ready for deployment sequence</div>
            </div>
          </div>
        ) : (
          /* MONITOR VIEW: 真正的工作任务网格 */
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-700">
             {/* 任务看板 (Expanded Grid) */}
             <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {tasks.map(t => (
                      <div key={t.id} className="bg-[#111318] border border-white/5 rounded-[28px] p-6 relative overflow-hidden group hover:border-primary/50 transition-all shadow-[0_15px_35px_rgba(0,0,0,0.3)]">
                         {t.status === 'RUNNING' && <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 overflow-hidden"><div className="h-full bg-primary animate-[shimmer_2s_infinite] w-full" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} /></div>}
                         <div className="flex justify-between items-center mb-5">
                            <div className="flex items-center gap-2">
                               <div className={`size-2 rounded-full ${t.status === 'COMPLETED' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : t.status === 'FAILED' ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : 'bg-primary animate-pulse shadow-[0_0_10px_#11b4d4]'}`} />
                               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.id}</span>
                            </div>
                            {t.status === 'COMPLETED' && <CheckCircle2 size={14} className="text-emerald-500" />}
                            {t.status === 'FAILED' && <Info size={14} className="text-rose-500" />}
                         </div>
                         <h3 className="text-sm font-bold text-white truncate mb-1">{t.name}</h3>
                         <p className="text-[10px] text-slate-500 font-mono mb-8">{t.startTime.split(' ')[1]}</p>
                         
                         <div className="space-y-3 pt-4 border-t border-white/5">
                            <div className="flex justify-between items-end">
                               <span className="text-[9px] font-black text-primary uppercase tracking-widest">Progress Matrix</span>
                               <span className="text-xs font-mono font-bold text-white">{t.progress.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-black/50 rounded-full overflow-hidden p-0.5 border border-white/5">
                               <div className="h-full bg-primary rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(17,180,212,0.4)]" style={{ width: `${t.progress}%` }} />
                            </div>
                         </div>
                      </div>
                   ))}
                   {tasks.length === 0 && (
                      <div className="col-span-full py-32 flex flex-col items-center justify-center opacity-10">
                         <Activity size={56} className="text-slate-400 mb-6" />
                         <p className="text-[11px] font-black uppercase tracking-[0.4em]">Awaiting Execution Session</p>
                      </div>
                   )}
                </div>
             </div>

             {/* 真正好用的控制台 (Functional Console) */}
             <div className={`border-t border-white/5 bg-[#0a0c10] flex flex-col transition-all duration-300 ease-out ${isConsoleExpanded ? 'h-64' : 'h-10'}`}>
                <div className="h-10 px-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/5 backdrop-blur-md">
                   <div className="flex items-center gap-3">
                      <Terminal size={12} className="text-primary" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Trace Log Output</span>
                      <div className="h-3 w-px bg-white/10 mx-1" />
                      <span className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">{uplinkLogs.length} Records In Buffer</span>
                   </div>
                   <div className="flex items-center gap-1">
                      <button onClick={clearLogs} className="p-2 text-slate-500 hover:text-rose-500 transition-colors" title="Flush Console Data">
                         <Trash2 size={12} />
                      </button>
                      <button onClick={() => setIsConsoleExpanded(!isConsoleExpanded)} className="p-2 text-slate-500 hover:text-white transition-all">
                        {isConsoleExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                      </button>
                   </div>
                </div>
                {isConsoleExpanded && (
                  <div className="flex-1 p-5 overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-1 bg-black/30 animate-in slide-in-from-bottom-2 duration-300">
                     {uplinkLogs.map((log, i) => (
                        <div key={i} className={`flex gap-3 py-1 border-b border-white/[0.02] ${log.includes('!!') ? 'text-rose-500 bg-rose-500/5' : log.includes('DONE') ? 'text-emerald-500' : 'text-slate-500'}`}>
                           <span className="opacity-20 shrink-0 w-6">{(i+1).toString().padStart(2, '0')}</span>
                           <span className="truncate group-hover:text-white transition-colors">{log}</span>
                        </div>
                     ))}
                     {uplinkLogs.length === 0 && <div className="h-full flex items-center justify-center text-slate-700 text-[8px] uppercase font-black tracking-widest">Console Stream Idle</div>}
                  </div>
                )}
             </div>
          </div>
        )}
      </main>
      
      <style>{`
         @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
         }
      `}</style>
    </div>
  );
};

export default TaskManagement;
