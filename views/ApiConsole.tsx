
import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, ShieldAlert, Cpu, Activity, Send, Loader2, Clipboard, Zap, 
  RefreshCw, Globe, Database, Code2, BookOpen, Link, Share2, 
  Server, HardDrive, BarChart, ShieldCheck, ExternalLink, ChevronRight,
  Filter, Download, Copy, PlayCircle, Radio, Network, BarChart3, Lock, Check, Code,
  FileJson, Rocket, Laptop, Lightbulb, CheckCircle2, FileText, Printer, X, Mail
} from 'lucide-react';
import { LogEntry } from '../types';
import { GoogleGenAI } from "@google/genai";

type ConsoleTab = 'CONNECTIVITY' | 'DEVELOPER' | 'LOGS';

const ApiConsole: React.FC<{ logs: LogEntry[]; addLog: (level: any, msg: string, payload?: any) => void }> = ({ logs, addLog }) => {
  const [activeTab, setActiveTab] = useState<ConsoleTab>('DEVELOPER');
  const [input, setInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');
  const [lang, setLang] = useState<'JS' | 'PY'>('JS');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [showPortalModal, setShowPortalModal] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    addLog('INFO', 'SYSTEM_RESET: Initiating environment re-scan...');
    setTimeout(() => {
        setIsRefreshing(false);
        addLog('SUCCESS', 'ENVIRONMENT_STABLE: All core services re-synchronized.');
    }, 1500);
  };

  const handleSimulation = (id: string) => {
    setSimulatingId(id);
    addLog('INFO', `API_SIMULATION: Initializing [${id}] request to sat-pro.ai/v1...`);
    setTimeout(() => {
        setSimulatingId(null);
        addLog('SUCCESS', `API_SIMULATION_COMPLETED: [${id}] returned 200 OK with valid JSON payload.`);
        // Set a brief success check on the button
        setCopiedId(`sim-success-${id}`);
        setTimeout(() => setCopiedId(null), 2000);
    }, 1200);
  };

  const exportDocAsPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const docHtml = document.getElementById('open-api-doc-content')?.innerHTML || "Document Content Missing";
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Sat-Pro API Documentation V2.1</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; color: #1e293b; padding: 50px; line-height: 1.6; max-width: 900px; margin: 0 auto; background: #fff; }
            h1 { font-weight: 900; font-size: 32px; color: #0f172a; border-bottom: 4px solid #11b4d4; padding-bottom: 15px; margin-bottom: 30px; }
            h2 { font-weight: 800; font-size: 20px; color: #334155; margin-top: 40px; text-transform: uppercase; letter-spacing: 0.05em; }
            h3 { font-weight: 900; font-size: 14px; text-transform: uppercase; color: #64748b; margin-top: 25px; }
            p { font-size: 14px; color: #475569; }
            .api-card { border: 1px solid #e2e8f0; border-radius: 20px; padding: 30px; margin-bottom: 30px; background: #f8fafc; page-break-inside: avoid; }
            .method { background: #10b981; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 900; margin-right: 10px; }
            code { background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #0f172a; }
            pre { background: #0f172a; color: #94a3b8; padding: 25px; border-radius: 15px; font-size: 12px; overflow-x: auto; margin: 15px 0; }
            .no-print { display: none !important; }
            .print-only { display: block; }
            .header-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; font-size: 12px; color: #94a3b8; font-weight: bold; }
            @media print { .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div class="header-info"><span>SAT-PRO DATA SYSTEMS</span><span>VERSION 2.1 STABLE</span></div>
          <h1>Sat-Pro 开放平台开发者文档</h1>
          <p>本平台提供开放式、低延迟卫星影像处理对接能力。以下接口为生产级 Public Endpoints，支持高并发数据检索与波段运算。开发者可傻瓜式直接开发对接，无需初始鉴权。</p>
          <div class="doc-body">${docHtml}</div>
          <script>
            window.onload = () => { 
                setTimeout(() => { window.print(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // External Connectivity Metrics
  const externalDBs = [
    { name: 'Planet SkySat API', status: 'ONLINE', latency: '124ms', requests: '8,421', volume: '1.24 TB', health: 99.8, provider: 'Planet Labs' },
    { name: 'Airbus OneAtlas', status: 'ONLINE', latency: '210ms', requests: '2,105', volume: '420 GB', health: 99.5, provider: 'Airbus Intel' },
    { name: 'Sentinel-Hub (OGC)', status: 'DEGRADED', latency: '640ms', requests: '15,240', volume: '5.10 TB', health: 88.2, provider: 'Sinergise' },
    { name: 'OpenWeather API', status: 'ONLINE', latency: '45ms', requests: '42,900', volume: '12 GB', health: 100, provider: 'OpenWeather' },
    { name: 'Maxar SecureWatch', status: 'OFFLINE', latency: '--', requests: '0', volume: '0 MB', health: 74.5, provider: 'Maxar' }
  ];

  const platformApis = [
    { 
      id: 'search',
      title: 'Satellite Assets Discovery',
      method: 'POST', 
      endpoint: '/api/v1/assets/search', 
      desc: '通过 ROI（感兴趣区域）和时间范围发现多源卫星影像资源。支持 Sentinel, Landsat 及商业源。', 
      protocol: 'HTTPS / JSON',
      schema: {
        request: '{\n  "geometry": "GeoJSON Polygon",\n  "filters": {\n    "cloud_max": 20,\n    "date_range": ["2024-01-01", "2024-06-01"],\n    "platforms": ["COPERNICUS/S2_SR"]\n  }\n}',
        response: '{\n  "status": "success",\n  "data": [\n    { "id": "S2/A/...", "thumb": "https://...", "cloud": 5.2 }\n  ]\n}'
      },
      js: `// Using Fetch API\nconst response = await fetch('https://api.sat-pro.ai/v1/assets/search', {\n  method: 'POST', \n  body: JSON.stringify({ geometry: myGeoJson, filters: { cloud_max: 20 } })\n});\nconst results = await response.json();`,
      py: `import requests\n\n# Direct REST Call\nresults = requests.post(\n    "https://api.sat-pro.ai/v1/assets/search",\n    json={"geometry": my_geojson, "filters": {"cloud_max": 20}}\n).json()`
    },
    { 
      id: 'export',
      title: 'Kernel Dispatch & Export',
      method: 'POST', 
      endpoint: '/api/v1/tasks/export', 
      desc: '初始化波段运算核（Kernels）并将处理任务调度至云端导出流水线。', 
      protocol: 'HTTPS / JSON',
      schema: {
        request: '{\n  "image_ids": ["COPERNICUS/S2/123"],\n  "algo_id": "ndvi_generator",\n  "format": "GeoTIFF",\n  "destination": "DRIVE"\n}',
        response: '{\n  "task_id": "T_99210",\n  "status": "QUEUED",\n  "tracking_url": "https://..."\n}'
      },
      js: `// Dispatch Processing Job\nconst task = await sdk.tasks.export({\n  ids: ["S2/123"],\n  algo: "ndvi_generator",\n  dest: "DRIVE"\n});`,
      py: `from sat_pro import Client\n\nclient = Client(api_key="public_open")\ntask = client.export(\n    image_ids=["S2/123"],\n    algo="ndvi_generator"\n)`
    },
    { 
      id: 'analytics',
      title: 'AI Analytics Retrieval',
      method: 'GET', 
      endpoint: '/api/v1/analytics/{task_id}', 
      desc: '获取 AI 处理节点的统计输出，包括分类比例、时间序列趋势和直方图众数。', 
      protocol: 'HTTPS / JSON',
      schema: {
        request: 'GET /api/v1/analytics/T_99210?metrics=true',
        response: '{\n  "task_id": "T_99210",\n  "results": {\n    "ndvi_mode": 0.72,\n    "veg_percentage": 68.5,\n    "anomaly_detected": false\n  }\n}'
      },
      js: `// Fetch AI Analysis Results\nconst report = await fetch('/api/v1/analytics/T_99210');\nconsole.log(await report.json());`,
      py: `results = client.get_analytics(task_id="T_99210")\nprint(f"Vegetation: {results['veg_percentage']}%")`
    }
  ];

  useEffect(() => {
    if (activeTab === 'LOGS') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const handleAiCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const cmd = input;
    setInput('');
    setIsAiProcessing(true);
    addLog('DEBUG', `COPROCESSOR_QUERY: ${cmd}`);

    try {
      const logContext = logs.slice(-30).map(l => `[${l.level}] ${l.message}`).join('\n');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `SYSTEM_LOG_CONTEXT (Latest 30 events):\n${logContext}\n\nUSER_COMMAND: ${cmd}`,
        config: { 
          systemInstruction: `你现在是卫星遥感平台的 DevOps 与排障专家。协助用户判断平台运行状况。基于日志事实给出建议。回复语言：中文，风格：专业、简洁、极客。` 
        }
      });
      addLog('INFO', response.text || 'Audit complete.');
    } catch (err) {
      addLog('ERROR', 'AI_LINK_FAILURE');
    } finally {
      setIsAiProcessing(false);
    }
  };

  const filteredLogs = logs.filter(log => filter === 'ALL' || log.level === filter);

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#050608] font-display">
      {/* Sidebar Navigation */}
      <aside className="w-20 border-r border-white/5 bg-[#0a0c10] flex flex-col items-center py-8 gap-8 shrink-0">
        <button 
          onClick={() => setActiveTab('CONNECTIVITY')} 
          className={`p-4 rounded-2xl transition-all ${activeTab === 'CONNECTIVITY' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-slate-600 hover:text-white'}`}
          title="Service Connectivity"
        >
          <Network size={22} />
        </button>
        <button 
          onClick={() => setActiveTab('DEVELOPER')} 
          className={`p-4 rounded-2xl transition-all ${activeTab === 'DEVELOPER' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-slate-600 hover:text-white'}`}
          title="Developer Documentation"
        >
          <Code2 size={22} />
        </button>
        <button 
          onClick={() => setActiveTab('LOGS')} 
          className={`p-4 rounded-2xl transition-all ${activeTab === 'LOGS' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-slate-600 hover:text-white'}`}
          title="System Protocol"
        >
          <Terminal size={22} />
        </button>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative bg-[#050608]">
        {/* Header Section */}
        <div className="h-20 px-10 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0 z-10">
          <div className="flex flex-col">
            <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">
               {activeTab === 'CONNECTIVITY' && 'Global Connectivity Mesh'}
               {activeTab === 'DEVELOPER' && 'Open API Documentation Center'}
               {activeTab === 'LOGS' && 'Kernel Telemetry Streams'}
            </h2>
            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1">
               {activeTab === 'DEVELOPER' ? 'Public Interface Protocol V2.1 - Build 2025' : 'Platform service status and telemetry.'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {activeTab === 'LOGS' && (
              <div className="flex items-center bg-black/40 rounded-xl border border-white/5 p-1">
                {['ALL', 'INFO', 'WARN', 'ERROR'].map(lvl => (
                  <button key={lvl} onClick={() => setFilter(lvl)} className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${filter === lvl ? 'bg-primary text-black' : 'text-slate-500'}`}>{lvl}</button>
                ))}
              </div>
            )}
            <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest group disabled:opacity-50 transition-all"
            >
              <RefreshCw size={14} className={`group-hover:rotate-180 transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`} /> 
              {isRefreshing ? 'Scanning...' : 'Refresh Environment'}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
          {activeTab === 'CONNECTIVITY' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {externalDBs.map((db, idx) => (
                 <div key={idx} className="bg-[#0d0f14] border border-white/5 rounded-[32px] p-6 space-y-4 hover:border-primary/40 transition-all shadow-2xl group">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className={`p-3 rounded-2xl ${db.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}><Database size={20} /></div>
                         <div><h4 className="text-[11px] font-black text-white uppercase">{db.name}</h4><p className="text-[8px] font-mono text-slate-500">{db.provider}</p></div>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${db.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>{db.status}</span>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black/40 rounded-2xl p-4 border border-white/5 group-hover:border-primary/10 transition-colors"><p className="text-[8px] text-slate-600 mb-2 uppercase">Latency</p><p className="text-[13px] font-mono font-bold text-slate-200">{db.latency}</p></div>
                      <div className="bg-black/40 rounded-2xl p-4 border border-white/5 group-hover:border-primary/10 transition-colors"><p className="text-[8px] text-slate-600 mb-2 uppercase">Health</p><p className="text-[13px] font-mono font-bold text-emerald-500">{db.health}%</p></div>
                   </div>
                 </div>
               ))}
            </div>
          )}

          {activeTab === 'DEVELOPER' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-bottom-6 duration-700">
               {/* Left: Detailed API Documentation */}
               <div className="lg:col-span-8 space-y-10" id="open-api-doc-content">
                  {/* Documentation Header */}
                  <div className="bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-[40px] p-8 flex items-center justify-between shadow-xl no-print">
                     <div className="flex items-center gap-6">
                        <div className="size-16 bg-primary rounded-[22px] flex items-center justify-center text-black shadow-lg shadow-primary/20"><Rocket size={28} /></div>
                        <div>
                           <h3 className="text-xl font-black text-white uppercase tracking-tight">Getting Started</h3>
                           <p className="text-[11px] text-slate-400 mt-1">开放式接口协议，支持 REST 与 SDK 调用。无需鉴权即可访问公共影像索引。</p>
                        </div>
                     </div>
                     <div className="flex flex-col items-end gap-3">
                        <button 
                            onClick={exportDocAsPdf}
                            className="px-6 py-2 bg-white/10 hover:bg-white text-slate-200 hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10"
                        >
                            <Printer size={14} /> Export API Doc (PDF)
                        </button>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono"><Globe size={12} /> api.sat-pro.ai/v1</div>
                     </div>
                  </div>

                  {/* API Endpoint Cards */}
                  <div className="space-y-8">
                    {platformApis.map((api) => (
                      <div key={api.id} id={`api-${api.id}`} className="bg-[#0d0f14] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl hover:border-white/10 transition-all api-card">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                           <div className="flex items-center gap-4">
                              <div className="size-10 bg-black rounded-xl border border-white/10 flex items-center justify-center text-primary"><FileJson size={18} /></div>
                              <div>
                                 <h3 className="text-xs font-black uppercase tracking-widest text-white">{api.title}</h3>
                                 <div className="flex items-center gap-3 mt-1">
                                    <span className="px-2 py-0.5 rounded text-[8px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 method">{api.method}</span>
                                    <code className="text-[10px] font-mono text-slate-500">{api.endpoint}</code>
                                 </div>
                              </div>
                           </div>
                           <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 no-print">
                              <button onClick={() => setLang('JS')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${lang === 'JS' ? 'bg-primary text-black' : 'text-slate-500'}`}>JS SDK</button>
                              <button onClick={() => setLang('PY')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${lang === 'PY' ? 'bg-primary text-black' : 'text-slate-500'}`}>Python</button>
                           </div>
                        </div>
                        <div className="p-8 space-y-6">
                           <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{api.desc}</p>
                           
                           <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                 <div className="flex justify-between items-center"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Laptop size={10} /> Request Payload</span><button onClick={() => copyToClipboard(api.schema.request, api.id)} className="text-slate-500 hover:text-white transition-colors">{copiedId === api.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}</button></div>
                                 <div className="bg-black/60 rounded-2xl p-5 border border-white/5 font-mono text-[9px] text-slate-300 leading-relaxed min-h-[120px] overflow-x-auto whitespace-pre">{api.schema.request}</div>
                              </div>
                              <div className="space-y-3">
                                 <div className="flex justify-between items-center"><span className="text-[8px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-1.5"><Code size={10} /> Implementation</span><button onClick={() => copyToClipboard(lang === 'JS' ? api.js : api.py, `${api.id}-code`)} className="text-primary/60 hover:text-primary transition-colors">{copiedId === `${api.id}-code` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}</button></div>
                                 <div className="bg-black/80 rounded-2xl p-5 border border-white/5 font-mono text-[9px] text-primary/90 leading-relaxed min-h-[120px] overflow-x-auto whitespace-pre">{lang === 'JS' ? api.js : api.py}</div>
                              </div>
                           </div>

                           <div className="pt-4 border-t border-white/5 flex items-center justify-between no-print">
                              <div className="flex items-center gap-4">
                                 <div className="flex items-center gap-2 text-[9px] text-slate-500"><CheckCircle2 size={12} className="text-emerald-500" /> Auto-Retry Support</div>
                                 <div className="flex items-center gap-2 text-[9px] text-slate-500"><CheckCircle2 size={12} className="text-emerald-500" /> Pagination Included</div>
                              </div>
                              <button 
                                onClick={() => handleSimulation(api.id)}
                                disabled={simulatingId === api.id}
                                className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest group transition-all"
                              >
                                {simulatingId === api.id ? <Loader2 size={14} className="animate-spin" /> : copiedId === `sim-success-${api.id}` ? <Check size={14} className="text-emerald-500" /> : <PlayCircle size={14} className="group-hover:scale-110 transition-transform" />}
                                {simulatingId === api.id ? 'Simulating...' : copiedId === `sim-success-${api.id}` ? 'Simulation OK' : 'Run Simulation'}
                              </button>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>

               {/* Right: Integration Recipes */}
               <div className="lg:col-span-4 space-y-8 no-print">
                  <div className="bg-[#0d0f14] border border-white/5 rounded-[40px] p-8 space-y-8 relative overflow-hidden shadow-2xl">
                     <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none rotate-12"><Share2 size={120} /></div>
                     
                     <div className="space-y-2 relative">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2"><Lightbulb size={16} className="text-primary" /> Integration Recipes</h4>
                        <p className="text-[10px] text-slate-500">将原子 API 组合为强大的业务解决方案。</p>
                     </div>

                     <div className="space-y-10 relative">
                        {[
                          { 
                            title: 'Real-time Crop Monitor', 
                            desc: '监测农场 NDVI 趋势并触发异常警报。',
                            steps: ['Search for latest Sentinel-2', 'Dispatch NDVI Kernel', 'Fetch Temporal Statistics']
                          },
                          { 
                            title: 'Urban Growth Analytics', 
                            desc: '对比年度灰度影像，计算非渗透面扩张比例。',
                            steps: ['Temporal Batch Search', 'Grayscale Processing', 'AI Classification Mode']
                          },
                          { 
                            title: 'Disaster Impact Report', 
                            desc: '快速生成受灾区域（如洪水/火灾）的前后对比报告。',
                            steps: ['Bitemporal Search', 'Difference Masking', 'AI Change Analytics']
                          }
                        ].map((recipe, i) => (
                           <div key={i} className="space-y-4 group cursor-pointer" onClick={() => setShowPortalModal(true)}>
                              <div className="flex items-center gap-3">
                                 <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-black text-[11px] group-hover:bg-primary group-hover:text-black transition-all">{i+1}</div>
                                 <h5 className="text-[11px] font-black text-white uppercase tracking-widest group-hover:text-primary transition-colors">{recipe.title}</h5>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-relaxed pl-11">{recipe.desc}</p>
                              <div className="pl-11 space-y-2">
                                 {recipe.steps.map((step, si) => (
                                    <div key={si} className="flex items-center gap-2 text-[8px] font-mono text-slate-600">
                                       <ChevronRight size={10} className="text-primary/40" /> {step}
                                    </div>
                                 ))}
                              </div>
                           </div>
                        ))}
                     </div>

                     <div className="pt-8 border-t border-white/5 text-center">
                        <button 
                            onClick={() => setShowPortalModal(true)}
                            className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-primary hover:text-black transition-all flex items-center justify-center gap-2 group"
                        >
                           View Full Developer Portal <ExternalLink size={14} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                     </div>
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[40px] p-8 space-y-4 shadow-xl">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2"><CheckCircle2 size={14} /> Open Data Policy</h4>
                     <p className="text-[9px] text-emerald-300/60 leading-relaxed font-medium">
                        本平台的 API 目前处于**完全开放阶段**。开发者可以直接调用所有公共端点（Public Endpoints），暂时无需 API Key 进行鉴权。单 IP 限制为 1000 RPM。
                     </p>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'LOGS' && (
            <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
               <div className="flex-1 bg-black/80 border border-white/5 rounded-[40px] overflow-hidden flex flex-col shadow-2xl">
                  <div className="flex-1 p-10 font-mono text-[11px] overflow-y-auto custom-scrollbar space-y-2">
                     {filteredLogs.map((log, idx) => (
                        <div key={idx} className="flex gap-6 group p-1.5 rounded-lg border border-transparent hover:bg-white/[0.02]">
                           <span className="text-slate-700 shrink-0 font-bold">[{log.timestamp.split('T')[1].split('.')[0]}]</span>
                           <span className={`font-black shrink-0 w-16 text-center rounded px-1 ${log.level === 'ERROR' ? 'text-rose-500' : log.level === 'SUCCESS' ? 'text-emerald-500' : 'text-primary'}`}>{log.level}</span>
                           <span className="text-slate-400 group-hover:text-slate-200 transition-colors">{log.message}</span>
                        </div>
                     ))}
                     <div ref={logEndRef} />
                  </div>
                  <form onSubmit={handleAiCommand} className="bg-black/60 p-10 border-t border-white/5 flex flex-col gap-6 relative">
                     {isAiProcessing && <div className="absolute top-0 left-0 w-full h-0.5"><div className="h-full bg-primary animate-terminal-scan w-full" /></div>}
                     <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-primary font-black text-[9px] uppercase px-3 py-1 bg-primary/5 rounded-lg border border-primary/20 shrink-0"><Terminal size={12} /> AI Coprocessor</div>
                        <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-[11px] text-slate-200 font-mono" placeholder="Input command (e.g., '分析最后一次任务失败原因' or '评估系统稳定性')" />
                        <button disabled={isAiProcessing} className="p-2 text-slate-500 hover:text-primary transition-all"><Send size={18} /></button>
                     </div>
                     <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 opacity-50"><ShieldCheck size={10} /> DevOps Protocol: Coprocessor now analysis last 30 log events for context.</p>
                  </form>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* Full Developer Portal Mock Modal */}
      {showPortalModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
           <div className="w-full max-w-4xl bg-[#0d0f14] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Rocket size={24} /></div>
                    <div>
                       <h3 className="text-lg font-black uppercase tracking-widest text-white">Advanced Developer Portal</h3>
                       <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Enterprise Integration Suites & Analytics Dashboard</p>
                    </div>
                 </div>
                 <button onClick={() => setShowPortalModal(false)} className="p-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-xl"><X size={24} /></button>
              </div>
              <div className="p-12 overflow-y-auto max-h-[70vh] custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-6">
                    <h4 className="text-[11px] font-black text-primary uppercase tracking-widest">Premium Features</h4>
                    {[
                       { icon: <ShieldCheck size={18} />, title: 'Advanced Auth', desc: 'OAuth2.0 / JWT integration for private data silos.' },
                       { icon: <BarChart size={18} />, title: 'Usage Analytics', desc: 'Real-time billing and request tracking by project.' },
                       { icon: <Globe size={18} />, title: 'Multi-Region Support', desc: 'Deploy Kernels to AWS, GCS or Azure proximity zones.' }
                    ].map((f, i) => (
                       <div key={i} className="flex gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl">
                          <div className="text-primary mt-1">{f.icon}</div>
                          <div><p className="text-xs font-black text-white uppercase">{f.title}</p><p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{f.desc}</p></div>
                       </div>
                    ))}
                 </div>
                 <div className="bg-black/40 border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="size-20 rounded-full border-4 border-dashed border-white/10 flex items-center justify-center animate-spin-slow"><Rocket size={32} className="text-slate-700" /></div>
                    <div className="space-y-2">
                        <h5 className="text-sm font-black text-white uppercase">Portal Under Maintenance</h5>
                        <p className="text-[10px] text-slate-500 leading-relaxed max-w-[280px]">We are currently migrating our Enterprise Hub to the V3 pipeline. Please reach out to our core team for dedicated infrastructure access.</p>
                    </div>
                    
                    <div className="pt-4 border-t border-white/5 w-full flex flex-col items-center gap-3">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Contact Engineering</span>
                        <a 
                            href="mailto:gonghuaze999@gmail.com" 
                            className="flex items-center gap-2 text-primary font-black text-sm underline hover:text-white transition-colors tracking-tight"
                        >
                            <Mail size={16} /> gonghuaze999@gmail.com
                        </a>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes terminal-scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } } 
        .animate-terminal-scan { animation: terminal-scan 1.5s infinite; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @media print { .no-print { display: none !important; } }
      ` }} />
    </div>
  );
};

export default ApiConsole;
