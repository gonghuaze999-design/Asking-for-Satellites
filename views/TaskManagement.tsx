
import React, { useState, useMemo, useEffect } from 'react';
import { Play, Code2, Activity, Trash2, Terminal, PackageCheck, Loader2, UploadCloud, X, BadgeCheck, FileCode, Calendar, Cloud, Target, Cpu, Radio, ShieldCheck, ShieldAlert, FileWarning, HelpCircle, Save, Info, BookOpen, Brackets, AlertCircle, RefreshCcw, ShieldCheck as ShieldIcon, Unlock, HardDrive, Check, Map as MapIcon } from 'lucide-react';
import { Task, SatelliteResult, AppTab } from '../types';
import { GeeService } from '../services/GeeService';
import { GoogleGenAI } from "@google/genai";

interface Algorithm {
  id: string;
  name: string;
  desc: string;
  code: string;
  category: string;
  author: string;
  createdAt: string;
  status: 'VALID' | 'INVALID' | 'TESTING' | 'UNSUPPORTED';
  errorReason?: string;
  isPersistent?: boolean; 
}

const DEFAULT_TEMPLATES: Algorithm[] = [
  { id: 'ndvi', name: 'NDVI Generator', desc: 'Produces single-band NDVI (B8-B4)/(B8+B4) as input for AI Workflow.', category: 'Vegetation', author: 'System', createdAt: '2024-01-01', status: 'VALID', isPersistent: true, code: `// Sentinel-2 NDVI Band Producer\n// Output: Single channel float image (NDVI)\nvar result = inputCollection.map(function(image) {\n  return image.normalizedDifference(['B8', 'B4']).rename('NDVI');\n});\n\nvar finalComposite = result.median().clip(geometry);\nprint(finalComposite);` },
  { id: 'gray_source', name: 'Grayscale Source', desc: 'Converts RGB to single-channel Luminance (0.299R + 0.587G + 0.114B).', category: 'Source', author: 'System', createdAt: '2025-05-20', status: 'VALID', isPersistent: true, code: `// Grayscale Conversion Kernel\n// Preparation for Histogram Mode Extraction in AI Process\nvar result = inputCollection.map(function(image) {\n  var gray = image.expression('0.299*R + 0.587*G + 0.114*B', {\n    'R': image.select('B4'),\n    'G': image.select('B3'),\n    'B': image.select('B2')\n  }).rename('Grayscale');\n  return gray;\n});\n\nvar finalComposite = result.median().clip(geometry);\nprint(finalComposite);` },
  { id: 'water', name: 'NDWI Generator', desc: 'Produces single-band NDWI (Green-NIR) for water analysis.', category: 'Water', author: 'System', createdAt: '2024-01-01', status: 'VALID', isPersistent: true, code: `// Sentinel-2 NDWI Band Producer\nvar result = inputCollection.map(function(image) {\n  return image.normalizedDifference(['B3', 'B8']).rename('NDWI');\n});\n\nvar finalComposite = result.median().clip(geometry);\nprint(finalComposite);` }
];

interface TaskManagementProps {
  tasks: Task[];
  inputData: SatelliteResult[];
  currentRoi: any;
  addTask: (name: string, type: string) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  setResults: (results: SatelliteResult[]) => void;
  setActiveTab: (tab: AppTab) => void;
}

const TaskManagement: React.FC<TaskManagementProps> = ({ tasks, inputData = [], currentRoi, addTask, updateTask, setResults, setActiveTab }) => {
  const [activeView, setActiveView] = useState<'DESIGN' | 'MONITOR'>('DESIGN');
  
  const [algorithms, setAlgorithms] = useState<Algorithm[]>(() => {
    try {
      const saved = localStorage.getItem('GEE_ALGO_LIB');
      const custom = saved ? JSON.parse(saved).map((a: any) => ({ ...a, isPersistent: true })) : [];
      const filteredCustom = custom.filter((c: any) => !DEFAULT_TEMPLATES.some(d => d.id === c.id));
      return [...DEFAULT_TEMPLATES, ...filteredCustom];
    } catch (e) {
      return DEFAULT_TEMPLATES;
    }
  });
  
  const [selectedAlgoId, setSelectedAlgoId] = useState('ndvi');
  const [codeContent, setCodeContent] = useState(DEFAULT_TEMPLATES[0].code);
  const [outputType, setOutputType] = useState('LOCAL');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uplinkLogs, setUplinkLogs] = useState<string[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', desc: '', category: 'General', code: '', error: '', status: 'IDLE' as Algorithm['status'] | 'IDLE' });
  const [isTesting, setIsTesting] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SatelliteResult | null>(null);

  const currentAlgo = algorithms.find(a => a.id === selectedAlgoId);
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;
  const runningCount = tasks.filter(t => t.status === 'RUNNING').length;

  useEffect(() => {
    const toStore = algorithms.filter(a => a.author === 'User' && a.isPersistent);
    localStorage.setItem('GEE_ALGO_LIB', JSON.stringify(toStore));
  }, [algorithms]);

  const addUplinkLog = (msg: string) => {
    setUplinkLogs(prev => [...prev.slice(-199), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleAlgoSelect = (algoId: string) => {
    setSelectedAlgoId(algoId);
    const algo = algorithms.find(a => a.id === algoId);
    if (algo) setCodeContent(algo.code);
  };

  const auditAlgorithmWithAI = async (code: string): Promise<{valid: boolean, reason?: string, status: Algorithm['status']}> => {
    setIsTesting(true);
    addUplinkLog("Deploying AI Auditor...");
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Review GEE code logic for remote sensing processing. Return JSON ONLY: {"valid": boolean, "reason": "string"}. Code: """ ${code} """`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0.1 }
      });
      const res = JSON.parse(response.text || '{"valid": false, "reason": "Timeout"}');
      return { valid: !!res.valid, reason: res.reason, status: res.valid ? 'VALID' : 'INVALID' };
    } catch (e: any) {
      let errorMsg = e.message || "Connection failure.";
      let status: Algorithm['status'] = 'INVALID';
      if (errorMsg.includes("location is not supported")) {
        errorMsg = "Regional Restriction. Use manual bypass.";
        status = 'UNSUPPORTED';
      }
      return { valid: false, reason: errorMsg, status };
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveOrAudit = async (isNew: boolean, forceTrust = false) => {
    const codeToSubmit = isNew ? uploadForm.code : codeContent;
    const nameToSubmit = isNew ? uploadForm.name : (currentAlgo?.name || 'Custom');

    if (forceTrust) {
      const newAlgo: Algorithm = {
        id: isNew ? `custom_${Date.now()}` : selectedAlgoId,
        name: nameToSubmit,
        desc: isNew ? uploadForm.desc : (currentAlgo?.desc || 'User logic'),
        category: isNew ? uploadForm.category : (currentAlgo?.category || 'General'),
        author: 'User',
        createdAt: new Date().toISOString(),
        code: codeToSubmit,
        status: 'VALID',
        isPersistent: false 
      };
      setAlgorithms(prev => isNew ? [...prev, newAlgo] : prev.map(a => a.id === selectedAlgoId ? newAlgo : a));
      if (isNew) setShowUploadModal(false);
      return;
    }

    setUploadForm(prev => ({ ...prev, error: '' }));
    const auditResult = await auditAlgorithmWithAI(codeToSubmit);
    
    if (isNew) {
      if (auditResult.valid) {
        const newAlgo: Algorithm = {
          id: `custom_${Date.now()}`,
          name: uploadForm.name,
          desc: uploadForm.desc,
          category: uploadForm.category,
          author: 'User',
          createdAt: new Date().toISOString(),
          code: uploadForm.code,
          status: 'VALID',
          isPersistent: false 
        };
        setAlgorithms(prev => [...prev, newAlgo]);
        setShowUploadModal(false);
        addUplinkLog(`SUCCESS: New algorithm [${newAlgo.name}] registered.`);
      } else {
        setUploadForm(prev => ({ ...prev, error: auditResult.reason || 'Audit failed. Check logic and syntax.' }));
      }
    } else {
      setAlgorithms(prev => prev.map(a => a.id === selectedAlgoId ? { ...a, code: codeContent, status: auditResult.status, errorReason: auditResult.reason } : a));
      if (!auditResult.valid) {
        addUplinkLog(`WARNING: Code audit failed for [${nameToSubmit}]. See inspector.`);
      } else {
        addUplinkLog(`SUCCESS: Audit passed for [${nameToSubmit}].`);
      }
    }
  };

  const handleManualTrust = () => {
    if (!currentAlgo) return;
    setAlgorithms(prev => prev.map(a => a.id === selectedAlgoId ? { ...a, status: 'VALID' } : a));
  };

  const handleSubmit = async () => {
    if (inputData.length === 0 || !currentRoi) return alert("System Check: Missing imagery or ROI.");
    
    const experimentName = currentAlgo?.name || 'PROC';
    const taskId = addTask(`Sentinel_${experimentName}_${outputType}`, outputType);
    setIsProcessing(true);
    setActiveView('MONITOR');
    setUplinkLogs([]);
    addUplinkLog(`INITIALIZING: Task [${taskId}] starting for ${inputData.length} scenes.`);

    try {
      if (outputType === 'LOCAL') {
        const updated: SatelliteResult[] = [...inputData];
        for (let i = 0; i < inputData.length; i++) {
          const img = inputData[i];
          addUplinkLog(`STEP ${i+1}/${inputData.length}: Uplinking [${img.id.split('/').pop()}]...`);
          
          try {
            const { url, fileName } = await GeeService.generateSingleLocalUrl(
              img.id, 
              img.date, 
              selectedAlgoId, 
              currentRoi, 
              experimentName.toUpperCase()
            );
            
            addUplinkLog(`...Pulling data to local buffer...`);
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const link = document.createElement('a'); 
            link.href = blobUrl; 
            link.download = `${fileName}.tif`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

            addUplinkLog(`SUCCESS: Local pipe saved as [${fileName}.tif]`);
            
            updated[i] = { ...img, localPath: `Downloads/${fileName}.tif` };
            updateTask(taskId, { progress: ((i + 1) / inputData.length) * 100 });
            
            await new Promise(resolve => setTimeout(resolve, 1500)); 
          } catch (sceneErr: any) {
            addUplinkLog(`FAILED: [${img.id.split('/').pop()}] -> ${sceneErr.message}`);
          }
        }
        if (setResults) setResults(updated);
      } else {
        addUplinkLog(`PIPELINE: Batch export [${outputType}] for ${inputData.length} records.`);
        const batchIds = await GeeService.startBatchExport(
          inputData.map(d => d.id),
          selectedAlgoId,
          currentRoi,
          outputType,
          `RUN_${Date.now().toString().slice(-4)}`,
          addUplinkLog
        );
        addUplinkLog(`COMPLETED: ${batchIds.length} tasks queued.`);
      }
      
      updateTask(taskId, { status: 'COMPLETED', progress: 100 });
      addUplinkLog(`SYSTEM: Pipeline finished.`);
    } catch (e: any) {
      addUplinkLog(`CRITICAL ERROR: ${e.message}`);
      updateTask(taskId, { status: 'FAILED', error: e.message });
    } finally { 
      setIsProcessing(false); 
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#050608] font-display relative">
      <aside className="w-72 border-r border-white/5 bg-[#0a0c10] flex flex-col shrink-0">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="size-1.5 bg-primary rounded-full shadow-[0_0_8px_#11b4d4]" />
             <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Execution Hub</h2>
          </div>
          <div className="flex bg-white/5 p-1 rounded-lg border border-white/5">
             <button onClick={() => setActiveView('DESIGN')} className={`p-1.5 rounded-md transition-all ${activeView === 'DESIGN' ? 'bg-primary text-black' : 'text-slate-500'}`}><Code2 size={12} /></button>
             <button onClick={() => setActiveView('MONITOR')} className={`p-1.5 rounded-md transition-all ${activeView === 'MONITOR' ? 'bg-primary text-black' : 'text-slate-500'}`}><Activity size={12} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {activeView === 'DESIGN' ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Input Generators</label>
                  <button onClick={() => { setShowUploadModal(true); setUploadForm({ name: '', desc: '', category: 'General', code: '', error: '', status: 'IDLE' }); }} className="text-primary hover:text-white transition-colors flex items-center gap-1">
                    <UploadCloud size={10} />
                    <span className="text-[8px] font-black uppercase tracking-tighter">Register New</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {algorithms.map(a => (
                    <div key={a.id} className="flex gap-1 items-stretch group relative">
                        <button onClick={() => handleAlgoSelect(a.id)} className={`flex-1 text-left p-3 rounded-xl border transition-all ${selectedAlgoId === a.id ? 'bg-primary/5 border-primary shadow-[0_0_15px_rgba(17,180,212,0.1)]' : 'bg-black/20 border-white/5 hover:border-white/10'}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <p className={`text-[10px] font-bold ${selectedAlgoId === a.id ? 'text-primary' : 'text-slate-200'}`}>{a.name}</p>
                                {a.status === 'VALID' ? <BadgeCheck size={11} className="text-emerald-500" /> : <ShieldAlert size={11} className="text-rose-500" />}
                            </div>
                            <p className="text-[7px] text-slate-500 line-clamp-1 uppercase tracking-tighter">
                              {a.isPersistent ? 'CLOUD PERSISTENT' : 'SESSION CACHE'}
                            </p>
                        </button>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={handleSubmit} disabled={isProcessing || inputData.length === 0} className="w-full bg-white hover:bg-primary text-black font-black text-xs uppercase py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl disabled:opacity-20">
                 {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Commit Pipeline
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Real-time Monitor</label>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 h-[400px] overflow-y-auto font-mono text-[8px] text-slate-500 space-y-1.5 custom-scrollbar">
                 {uplinkLogs.map((log, i) => <div key={i} className={`${log.includes('SUCCESS') ? 'text-emerald-400' : log.includes('FAILED') || log.includes('ERROR') || log.includes('WARNING') ? 'text-rose-400' : 'text-slate-400'}`}>{log}</div>)}
                 {uplinkLogs.length === 0 && <div className="h-full flex flex-col items-center justify-center opacity-20"><Terminal size={24} className="mx-auto mb-2" /><span>Awaiting Pipeline Execution...</span></div>}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#050608]">
        <div className="h-60 border-b border-white/5 bg-black/40 p-6 flex flex-col gap-4 overflow-hidden shrink-0">
           <div className="flex-1 overflow-x-auto flex gap-4 pb-4 custom-scrollbar">
              {inputData.map((img, i) => (
                <div key={img.id || i} onClick={() => setSelectedResult(img)} className={`min-w-[220px] h-40 bg-[#111318] rounded-2xl border transition-all overflow-hidden flex flex-col cursor-pointer group ${selectedResult?.id === img.id ? 'border-primary shadow-[0_0_15px_rgba(17,180,212,0.2)]' : 'border-white/5 hover:border-white/10'}`}>
                   <div className="h-24 bg-black relative">
                      <img src={img.thumbnail} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 text-[8px] font-mono text-primary rounded-lg border border-primary/20 backdrop-blur-md uppercase">IDX: {i+1}</div>
                   </div>
                   <div className="p-3 flex-1 flex flex-col justify-between bg-white/[0.02]">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black text-slate-200 truncate pr-2" title={img.id}>{img.id.split('/').pop()}</p>
                        <span className="text-[8px] font-mono text-primary/60 shrink-0">{img.cloudCover}%</span>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>

        <div className="flex-1 flex flex-col bg-[#07080a] min-h-0 relative">
           <div className="h-10 px-6 flex items-center justify-between shrink-0 bg-[#0a0c10] border-b border-white/5 z-10">
              <div className="flex items-center gap-2 text-slate-500 font-black text-[9px] uppercase tracking-widest"><FileCode size={12} /> Live_Kernel_Payload.js</div>
           </div>
           
           <div className="flex-1 relative flex flex-col">
              <textarea value={codeContent} onChange={e => setCodeContent(e.target.value)} spellCheck={false} className="w-full flex-1 bg-transparent p-10 pl-14 text-slate-400 font-mono text-xs outline-none resize-none leading-relaxed" />
              {currentAlgo?.errorReason && (
                <div className="absolute bottom-6 right-6 left-14 backdrop-blur-md p-4 rounded-2xl flex items-start gap-4 border border-rose-500/20 bg-rose-500/10 z-20 shadow-2xl">
                  <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">Auditor Feedback</p>
                    <p className="text-[9px] text-slate-300 font-mono leading-relaxed">{currentAlgo.errorReason}</p>
                  </div>
                </div>
              )}
           </div>
        </div>
      </main>

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6">
          <div className="w-full max-w-6xl h-[85vh] bg-[#0d0f14] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col">
             <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                   <div className="p-2.5 bg-primary/10 rounded-2xl text-primary"><UploadCloud size={20} /></div>
                   <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-white">Generator Uplink</h3>
                </div>
                <button onClick={() => setShowUploadModal(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
             </div>
             <div className="flex-1 flex overflow-hidden">
                <div className="w-80 border-r border-white/5 p-8 space-y-6 overflow-y-auto custom-scrollbar bg-black/20">
                   <div className="space-y-4">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Identification</label>
                      <input placeholder="Kernel Name" value={uploadForm.name} onChange={e => setUploadForm({...uploadForm, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-primary/40 transition-all" />
                      <textarea placeholder="Operation summary..." value={uploadForm.desc} onChange={e => setUploadForm({...uploadForm, desc: e.target.value})} className="w-full h-24 bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-slate-400 outline-none resize-none focus:border-primary/40 transition-all" />
                   </div>
                   
                   {/* Audit Error Message Display */}
                   {uploadForm.error && (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 text-rose-500">
                           <AlertCircle size={14} />
                           <span className="text-[9px] font-black uppercase tracking-widest">Audit Failed</span>
                        </div>
                        <p className="text-[9px] font-mono text-rose-300 leading-relaxed">{uploadForm.error}</p>
                      </div>
                   )}
                </div>
                <div className="flex-1 flex flex-col bg-[#07080a]">
                   <div className="h-8 px-6 flex items-center bg-black/40 border-b border-white/5">
                      <span className="text-[9px] font-mono text-slate-500 uppercase">JavaScript (GEE Environment)</span>
                   </div>
                   <textarea value={uploadForm.code} onChange={e => setUploadForm({...uploadForm, code: e.target.value})} spellCheck={false} placeholder="// Enter GEE Logic (JavaScript) here..." className="flex-1 bg-transparent p-10 font-mono text-sm text-primary/80 outline-none resize-none leading-relaxed" />
                </div>
             </div>
             <div className="p-8 bg-black/40 border-t border-white/5 flex items-center justify-end gap-4">
                <button onClick={() => setShowUploadModal(false)} className="px-8 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancel</button>
                <button onClick={() => handleSaveOrAudit(true)} disabled={isTesting || !uploadForm.name || !uploadForm.code} className="bg-primary text-black px-12 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                  {isTesting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  {isTesting ? 'Analyzing...' : 'Audit & Archive'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManagement;
