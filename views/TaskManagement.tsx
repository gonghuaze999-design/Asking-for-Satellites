import React, { useState, useMemo, useEffect } from 'react';
import { Play, Code2, Activity, Trash2, Terminal, PackageCheck, Loader2, UploadCloud, X, BadgeCheck, FileCode, Calendar, Cloud, Target, Cpu, Radio, ShieldCheck, ShieldAlert, FileWarning, HelpCircle, Save, Info, BookOpen, Brackets, AlertCircle, RefreshCcw, ShieldCheck as ShieldIcon, Unlock, HardDrive, Check, Map as MapIcon, Database } from 'lucide-react';
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
      return [...DEFAULT_TEMPLATES, ...custom];
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

  const currentAlgo = algorithms.find(a => a.id === selectedAlgoId);

  // Persistence management
  const saveAlgorithm = (id: string) => {
    setAlgorithms(prev => {
        const next = prev.map(a => a.id === id ? { ...a, isPersistent: true } : a);
        const toStore = next.filter(a => a.author === 'User' && a.isPersistent);
        localStorage.setItem('GEE_ALGO_LIB', JSON.stringify(toStore));
        return next;
    });
  };

  const deleteAlgorithm = (id: string) => {
    setAlgorithms(prev => {
        const next = prev.filter(a => a.id !== id);
        const toStore = next.filter(a => a.author === 'User' && a.isPersistent);
        localStorage.setItem('GEE_ALGO_LIB', JSON.stringify(toStore));
        if (selectedAlgoId === id) setSelectedAlgoId('ndvi');
        return next;
    });
  };

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
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0.1 }
      });
      const res = JSON.parse(response.text || '{"valid": false, "reason": "Timeout"}');
      return { valid: !!res.valid, reason: res.reason, status: res.valid ? 'VALID' : 'INVALID' };
    } catch (e: any) {
      return { valid: false, reason: e.message || "Connection failure.", status: 'INVALID' };
    } finally {
      setIsTesting(false);
    }
  };

  const handleUploadSubmit = async () => {
    setUploadForm(prev => ({ ...prev, error: '' }));
    const auditResult = await auditAlgorithmWithAI(uploadForm.code);
    
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
      setSelectedAlgoId(newAlgo.id);
      setCodeContent(newAlgo.code);
      setShowUploadModal(false);
      addUplinkLog(`SUCCESS: New algorithm [${newAlgo.name}] registered. Click SAVE to persist.`);
    } else {
      setUploadForm(prev => ({ ...prev, error: auditResult.reason || 'Audit failed.' }));
    }
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
          addUplinkLog(`STEP ${i+1}/${inputData.length}: Processing [${img.id.split('/').pop()}]...`);
          try {
            const { url, fileName } = await GeeService.generateSingleLocalUrl(img.id, img.date, selectedAlgoId, currentRoi, experimentName.toUpperCase());
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
            addUplinkLog(`SUCCESS: Saved as [${fileName}.tif]`);
            updated[i] = { ...img, localPath: `Downloads/${fileName}.tif` };
            updateTask(taskId, { progress: ((i + 1) / inputData.length) * 100 });
            await new Promise(resolve => setTimeout(resolve, 1500)); 
          } catch (sceneErr: any) { addUplinkLog(`FAILED: [${img.id.split('/').pop()}] -> ${sceneErr.message}`); }
        }
        if (setResults) setResults(updated);
      } else {
        await GeeService.startBatchExport(inputData.map(d => d.id), selectedAlgoId, currentRoi, outputType, `RUN_${Date.now().toString().slice(-4)}`, addUplinkLog);
      }
      updateTask(taskId, { status: 'COMPLETED', progress: 100 });
      addUplinkLog(`SYSTEM: Pipeline finished.`);
    } catch (e: any) {
      addUplinkLog(`CRITICAL ERROR: ${e.message}`);
      updateTask(taskId, { status: 'FAILED', error: e.message });
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#050608] font-display relative">
      <aside className="w-80 border-r border-white/5 bg-[#0a0c10] flex flex-col shrink-0">
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2">
                <div className="size-1.5 bg-primary rounded-full shadow-[0_0_8px_#11b4d4]" />
                <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Algorithm Library</h2>
             </div>
             <span className="text-[7px] font-mono text-primary uppercase ml-3.5">Scenes: {inputData.length}</span>
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
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Operators</label>
                  <button onClick={() => { setShowUploadModal(true); setUploadForm({ name: '', desc: '', category: 'General', code: '', error: '', status: 'IDLE' }); }} className="text-primary hover:text-white transition-colors flex items-center gap-1">
                    <UploadCloud size={10} />
                    <span className="text-[8px] font-black uppercase tracking-tighter">Uplink Code</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {algorithms.map(a => (
                    <div key={a.id} className="group relative flex gap-1">
                        <button onClick={() => handleAlgoSelect(a.id)} className={`flex-1 text-left p-3 rounded-xl border transition-all ${selectedAlgoId === a.id ? 'bg-primary/5 border-primary' : 'bg-black/20 border-white/5 hover:border-white/10'}`}>
                            <div className="flex items-center justify-between mb-1">
                                <p className={`text-[10px] font-bold ${selectedAlgoId === a.id ? 'text-primary' : 'text-slate-200'}`}>{a.name}</p>
                                {a.status === 'VALID' ? <BadgeCheck size={11} className="text-emerald-500" /> : <ShieldAlert size={11} className="text-rose-500" />}
                            </div>
                            <p className="text-[7px] text-slate-500 uppercase tracking-tighter">{a.author === 'System' ? 'System Core' : a.isPersistent ? 'Cloud Saved' : 'Temporary Session'}</p>
                        </button>
                        
                        {a.author === 'User' && (
                           <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!a.isPersistent && (
                                <button onClick={() => saveAlgorithm(a.id)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-black transition-all" title="Save to Persistent Storage">
                                  <Save size={12} />
                                </button>
                              )}
                              <button onClick={() => deleteAlgorithm(a.id)} className="p-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all" title="Delete">
                                <Trash2 size={12} />
                              </button>
                           </div>
                        )}
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
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 h-[450px] overflow-y-auto font-mono text-[8px] text-slate-500 space-y-1.5 custom-scrollbar">
                 {uplinkLogs.map((log, i) => <div key={i} className={`${log.includes('SUCCESS') ? 'text-emerald-400' : log.includes('FAILED') || log.includes('ERROR') ? 'text-rose-400' : 'text-slate-400'}`}>{log}</div>)}
                 {uplinkLogs.length === 0 && <div className="h-full flex flex-col items-center justify-center opacity-20"><Terminal size={24} className="mx-auto mb-2" /><span>Awaiting Execution...</span></div>}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#050608]">
        <div className="h-60 border-b border-white/5 bg-black/40 p-6 flex flex-col gap-4 overflow-hidden shrink-0">
           <div className="flex-1 overflow-x-auto flex gap-4 pb-4 custom-scrollbar">
              {inputData.map((img, i) => (
                <div key={img.id || i} className={`min-w-[220px] h-40 bg-[#111318] rounded-2xl border transition-all overflow-hidden flex flex-col ${img.localPath ? 'border-emerald-500/30' : 'border-white/5'}`}>
                   <div className="h-24 bg-black relative">
                      <img src={img.thumbnail} className="w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        {img.localPath && <div className="px-2 py-1 bg-emerald-500 text-[8px] font-black text-black rounded-lg uppercase">SAVED</div>}
                        <div className="px-2 py-1 bg-black/80 text-[8px] font-mono text-primary rounded-lg border border-primary/20 backdrop-blur-md uppercase">IDX: {i+1}</div>
                      </div>
                   </div>
                   <div className="p-3 flex-1 flex flex-col justify-between">
                      <div className="flex justify-between items-center"><p className="text-[10px] font-black text-slate-200">{img.date}</p><span className="text-[8px] font-mono text-primary/60">{img.cloudCover}%</span></div>
                      <p className="text-[7px] font-mono text-slate-600 truncate uppercase mt-0.5">{img.metadata.sensingTime}</p>
                   </div>
                </div>
              ))}
              {inputData.length === 0 && (
                 <div className="flex-1 flex flex-col items-center justify-center opacity-10 border-2 border-dashed border-white/10 rounded-3xl">
                    <Database size={40} className="mb-2" />
                    <p className="text-xs font-black uppercase">Awaiting Imagery Input</p>
                 </div>
              )}
           </div>
        </div>

        <div className="flex-1 flex flex-col bg-[#07080a] min-h-0 relative">
           <div className="h-10 px-6 flex items-center bg-[#0a0c10] border-b border-white/5 z-10"><div className="text-slate-500 font-black text-[9px] uppercase tracking-widest flex items-center gap-2"><FileCode size={12} /> Active_Payload.js</div></div>
           <textarea value={codeContent} onChange={e => setCodeContent(e.target.value)} spellCheck={false} className="w-full flex-1 bg-transparent p-10 pl-14 text-slate-400 font-mono text-xs outline-none resize-none leading-relaxed" />
        </div>
      </main>

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
                   {uploadForm.error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl"><p className="text-[9px] font-mono text-rose-300 leading-relaxed">{uploadForm.error}</p></div>}
                </div>
                <div className="flex-1 flex flex-col bg-[#07080a]">
                   <textarea value={uploadForm.code} onChange={e => setUploadForm({...uploadForm, code: e.target.value})} spellCheck={false} placeholder="// Enter GEE Logic (JavaScript) here..." className="flex-1 bg-transparent p-10 font-mono text-sm text-primary/80 outline-none resize-none leading-relaxed" />
                </div>
             </div>
             <div className="p-8 bg-black/40 border-t border-white/5 flex items-center justify-end gap-4">
                <button onClick={() => setShowUploadModal(false)} className="px-8 py-3 text-[10px] font-black uppercase text-slate-500">Cancel</button>
                <button onClick={handleUploadSubmit} disabled={isTesting || !uploadForm.name || !uploadForm.code} className="bg-primary text-black px-12 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg flex items-center gap-3">
                  {isTesting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                  {isTesting ? 'Analyzing...' : 'Audit & Import'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManagement;