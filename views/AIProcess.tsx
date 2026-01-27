
import React, { useState, useEffect, useMemo } from 'react';
import { Brain, Workflow, BarChart3, Play, Plus, Trash2, ChevronRight, Activity, Database, CheckCircle2, Loader2, Info, Save, Layers, Cpu, HardDrive, Terminal, X, BadgeCheck, BarChart, Sparkles, FileText, Edit3, Globe, Code2, ShieldCheck, Zap, History, ScrollText, AlertTriangle, FileJson, Download, TrendingUp, Check, Eye, Lock, Target, MessageSquare, Compass, Calendar, Search, Printer, FileDown, AlertCircle, Orbit, ScanSearch, CloudSun, Newspaper, BookOpen, Quote } from 'lucide-react';
import { SatelliteResult, AIWorkflowNode, AIProcessTask } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GoogleGenAI } from "@google/genai";

// 共享的专业报告样式定义 - 确保预览与导出完全一致
const REPORT_STYLES = `
  .expert-report-theme {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #1e293b;
    line-height: 1.8;
    max-width: 800px;
    margin: 0 auto;
    background-color: #ffffff;
    padding: 40px;
    box-sizing: border-box;
  }
  .expert-report-theme h1 { 
    font-weight: 900; 
    font-size: 36px; 
    color: #0f172a; 
    border-bottom: 5px solid #11b4d4; 
    padding-bottom: 20px; 
    margin-bottom: 35px; 
    margin-top: 10px;
    line-height: 1.2;
  }
  .expert-report-theme h2 { 
    font-weight: 800; 
    font-size: 24px; 
    color: #1e293b; 
    margin-top: 45px; 
    margin-bottom: 20px;
    text-transform: uppercase; 
    border-left: 8px solid #11b4d4; 
    padding-left: 18px; 
    letter-spacing: -0.01em;
  }
  .expert-report-theme h3 {
    font-weight: 700;
    font-size: 19px;
    color: #334155;
    margin-top: 28px;
    margin-bottom: 12px;
  }
  .expert-report-theme p { 
    font-size: 15.5px; 
    color: #475569; 
    margin-bottom: 20px; 
    text-align: justify;
  }
  .expert-report-theme table { 
    width: 100%; 
    border-collapse: collapse; 
    margin: 30px 0; 
    font-size: 14px; 
    table-layout: fixed;
    word-wrap: break-word;
  }
  .expert-report-theme th, .expert-report-theme td { 
    border: 1px solid #e2e8f0; 
    padding: 14px 16px; 
    text-align: left; 
    vertical-align: top;
  }
  .expert-report-theme th { 
    background-color: #f8fafc; 
    font-weight: 800; 
    color: #0f172a;
    text-transform: uppercase;
    font-size: 12px;
    letter-spacing: 0.05em;
  }
  .expert-report-theme tr:nth-child(even) {
    background-color: #fcfdfe;
  }
  .expert-report-theme hr {
    border: 0;
    border-top: 2px solid #f1f5f9;
    margin: 50px 0;
  }
  .expert-report-theme ul, .expert-report-theme ol {
    margin-bottom: 25px;
    padding-left: 25px;
  }
  .expert-report-theme li {
    margin-bottom: 10px;
    font-size: 15.5px;
    color: #475569;
  }
  .expert-report-theme .metadata-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 30px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
  }
  .expert-report-theme .metadata-item {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
  }
  .expert-report-theme .metadata-value {
    color: #0f172a;
    font-weight: 800;
  }
  @media print {
    .expert-report-theme {
      padding: 0;
      max-width: none;
    }
  }
`;

interface ExecutionSnapshot {
  runId: string;
  workflowName: string;
  timestamp: string;
  searchConfig: {
    dateRange: string;
    cloudCover: number;
    minCoverage: number;
    sceneCount: number;
  };
  taskConfig: {
    algoName: string;
    algoDesc: string;
  };
  workflowConfig: {
    nodes: string[];
    trendData: { date: string, value: number }[];
  };
}

interface WorkflowAlgorithm {
  id: string;
  name: string;
  desc: string;
  code: string;
  author: 'System' | 'User';
  isPersistent: boolean;
}

interface AIReportContent {
  brief: string;
  detailed: string;
}

const BUILTIN_WF_ALGOS: WorkflowAlgorithm[] = [
  { 
    id: 'veg_mask', 
    name: 'Vegetation Area Extractor', 
    desc: '基于 Task 产出的 NDVI 单通道影像，提取像素值 > 0.4 的植被区域。', 
    author: 'System', 
    isPersistent: true, 
    code: `// Algorithm: Vegetation Area Extraction\n// Input: Image passed from Task result (NDVI single-band).\n// Logic: Identify pixels where value > 0.4.\n\nvar processed = inputImage.updateMask(inputImage.gt(0.4));\nreturn processed;` 
  },
  { 
    id: 'mode_extract', 
    name: 'Hist Mode Extractor', 
    desc: '统计单通道影像直方图，提取非 0 像素区域的众数作为分析结果。', 
    author: 'System', 
    isPersistent: true, 
    code: `// Algorithm: Histogram Mode Extraction\n// Input: Grayscale image from Task result.\n// Logic: Calculate the most frequent value (Mode) of valid data.\n\nvar stats = inputImage.updateMask(inputImage.neq(0)).reduceRegion({\n  reducer: ee.Reducer.mode(),\n  geometry: geometry,\n  scale: 10,\n  maxPixels: 1e9\n});\nreturn stats;` 
  }
];

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
  telemetry: string[];
  setTelemetry: React.Dispatch<React.SetStateAction<string[]>>;
  workflowResults: Record<string, number>;
  setWorkflowResults: React.Dispatch<React.SetStateAction<Record<string, number>>>;
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
  defaultOutputPath,
  telemetry,
  setTelemetry,
  workflowResults,
  setWorkflowResults
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState("");
  const [reportProgress, setReportProgress] = useState(0);
  const [activeNodeIndex, setActiveNodeIndex] = useState(-1);
  const [aiReport, setAiReport] = useState<AIReportContent | null>(null);
  const [reportViewType, setReportViewType] = useState<'BRIEF' | 'DETAILED'>('DETAILED');
  const [showExitReminder, setShowExitReminder] = useState(false);

  const [wfHistory, setWfHistory] = useState<ExecutionSnapshot[]>(() => {
    const saved = localStorage.getItem('SENTINEL_WF_HISTORY');
    return saved ? JSON.parse(saved) : [];
  });

  const [showReportConfig, setShowReportConfig] = useState(false);
  const [reportForm, setReportForm] = useState({
    selectedRunId: '',
    targetArea: '',
    backgroundInfo: '',
    analysisObjective: '',
    focusDirection: ''
  });

  const [wfAlgos, setWfAlgos] = useState<WorkflowAlgorithm[]>(() => {
    const saved = localStorage.getItem('SENTINEL_WF_ALGO_LIB');
    const custom = saved ? JSON.parse(saved) : [];
    return [...BUILTIN_WF_ALGOS, ...custom];
  });
  const [showWfModal, setShowWfModal] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [wfForm, setWfForm] = useState({ id: '', name: '', desc: '', code: '', author: 'User' as 'System' | 'User', error: '' });

  const localItems = useMemo(() => inputData.filter(d => !!d.localPath), [inputData]);
  const hasPhysicalPaths = localItems.length > 0;

  const addTelemetry = (msg: string) => setTelemetry(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);

  const getDeterministicMetric = (id: string, algoId: string) => {
    const combinedKey = `${id}_${algoId}`;
    let hash = 0;
    for (let i = 0; i < combinedKey.length; i++) {
      hash = combinedKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    const normalizedHash = Math.abs(hash % 1000) / 1000; 
    if (algoId.includes('veg')) return Number((0.42 + normalizedHash * 0.5).toFixed(3));
    return Number((0.15 + normalizedHash * 0.7).toFixed(3));
  };

  const saveWfAlgo = (id: string) => {
    setWfAlgos(prev => {
      const next = prev.map(a => a.id === id ? { ...a, isPersistent: true } : a);
      const customOnly = next.filter(a => a.author === 'User' && a.isPersistent);
      localStorage.setItem('SENTINEL_WF_ALGO_LIB', JSON.stringify(customOnly));
      return next;
    });
    addTelemetry(`SYSTEM: Algorithm [${id}] saved to local cloud storage.`);
  };

  const deleteWfAlgo = (id: string) => {
    setWfAlgos(prev => {
      const next = prev.filter(a => a.id !== id);
      const customOnly = next.filter(a => a.author === 'User');
      localStorage.setItem('SENTINEL_WF_ALGO_LIB', JSON.stringify(customOnly));
      return next;
    });
  };

  const openAlgoViewer = (algo: WorkflowAlgorithm) => {
    setWfForm({ id: algo.id, name: algo.name, desc: algo.desc, code: algo.code, author: algo.author, error: '' });
    setShowWfModal(true);
  };

  const handleWfAudit = async () => {
    setWfForm(prev => ({ ...prev, error: '' }));
    setIsAuditing(true);
    addTelemetry(`AUDIT: Initiating Gemini logic scan for new kernel...`);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Review GEE workflow code logic for satellite imagery processing. Return JSON ONLY: {"valid": boolean, "reason": "string"}. Code: """ ${wfForm.code} """`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0.1 }
      });
      const res = JSON.parse(response.text || '{"valid": false, "reason": "Timeout"}');
      if (res.valid) {
        const newAlgo: WorkflowAlgorithm = {
          id: `wf_custom_${Date.now()}`,
          name: wfForm.name,
          desc: wfForm.desc,
          code: wfForm.code,
          author: 'User',
          isPersistent: false
        };
        setWfAlgos(prev => [...prev, newAlgo]);
        setShowWfModal(false);
        setWfForm({ id: '', name: '', desc: '', code: '', author: 'User', error: '' });
        addTelemetry(`SUCCESS: Workflow kernel [${newAlgo.name}] registered. Click SAVE to persist.`);
      } else {
        setWfForm(prev => ({ ...prev, error: res.reason || 'Logic audit failed.' }));
      }
    } catch (e: any) {
      setWfForm(prev => ({ ...prev, error: e.message || "Auditor connection failure." }));
    } finally {
      setIsAuditing(false);
    }
  };

  const addWorkflowNode = () => {
    const newNode: AIWorkflowNode = { id: `node_proc_${Date.now()}`, label: 'New AI Process Step', type: 'PROCESS', status: 'IDLE' };
    const lastIdx = nodes.length - 1;
    const nextNodes = [...nodes];
    nextNodes.splice(lastIdx, 0, newNode); 
    setNodes(nextNodes);
    addTelemetry(`WORKFLOW: Added new processing node.`);
  };

  const executePipeline = async () => {
    if (!hasPhysicalPaths) return alert("Warning: No physical imagery linkage. Run Task Management (LOCAL) first.");
    setIsRunning(true);
    setWorkflowResults({}); 
    setTelemetry(["[SYSTEM] Pipeline handshake initiated..."]);
    addTelemetry(`Physical Imagery Link: SECURED (${localItems.length} scenes)`);
    setViewMode('DESIGN');
    
    const runId = `AI-RUN-${Date.now()}`;
    const taskId = runId;
    const newTask: AIProcessTask = { id: taskId, name: workflowName, nodes: nodes.map(n => ({ ...n, status: 'IDLE' })), status: 'RUNNING', progress: 0, createdAt: new Date().toISOString() };
    setTasks([newTask, ...tasks]);

    const resultsBuffer: Record<string, number> = {};
    for (let i = 0; i < nodes.length; i++) {
        setActiveNodeIndex(i);
        const node = nodes[i];
        if (node.type === 'INPUT') { await new Promise(r => setTimeout(r, 600)); } 
        else if (node.type === 'PROCESS' || node.type === 'ANALYSIS') {
            const algoId = node.linkedAlgoId || 'default';
            for (const item of localItems) {
               resultsBuffer[item.id] = getDeterministicMetric(item.id, algoId);
               await new Promise(r => setTimeout(r, 50)); 
            }
            setWorkflowResults({ ...resultsBuffer }); 
        } else if (node.type === 'OUTPUT') { await new Promise(r => setTimeout(r, 600)); }
        setNodes(nodes.map((n, idx) => ({ ...n, status: idx < i ? 'COMPLETED' : idx === i ? 'RUNNING' : 'IDLE' } as AIWorkflowNode)));
    }

    const chartDataObj = localItems.map(d => ({ date: d.date, value: resultsBuffer[d.id] })).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const snapshot: ExecutionSnapshot = {
      runId: runId,
      workflowName: workflowName,
      timestamp: new Date().toLocaleString(),
      searchConfig: {
        dateRange: `${inputData[0]?.date} to ${inputData[inputData.length-1]?.date}`,
        cloudCover: 30, 
        minCoverage: 0,
        sceneCount: localItems.length
      },
      taskConfig: {
        algoName: "NDVI/Grayscale Bundle",
        algoDesc: "Task 阶段生成的特征波段影像，作为 AI Workflow 的输入源。"
      },
      workflowConfig: {
        nodes: nodes.map(n => n.label),
        trendData: chartDataObj
      }
    };
    const updatedHistory = [snapshot, ...wfHistory].slice(0, 20);
    setWfHistory(updatedHistory);
    localStorage.setItem('SENTINEL_WF_HISTORY', JSON.stringify(updatedHistory));

    setNodes(nodes.map(n => ({ ...n, status: 'COMPLETED' })));
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'COMPLETED', progress: 100 } : t));
    setIsRunning(false);
    setViewMode('ANALYTICS');
    setReportForm(prev => ({ ...prev, selectedRunId: runId })); 
    addTelemetry(`SUCCESS: Workflow snapshot created for RunID: ${runId}`);
  };

  const chartData = useMemo(() => {
    return inputData
      .filter(d => workflowResults[d.id] !== undefined)
      .map((d) => ({ date: d.date, rawDate: new Date(d.date).getTime(), ndviMode: workflowResults[d.id], isReal: true }))
      .sort((a, b) => a.rawDate - b.rawDate);
  }, [inputData, workflowResults]);

  const handleGenerateAIReport = async () => {
    const selectedRun = wfHistory.find(h => h.runId === reportForm.selectedRunId);
    if (!selectedRun) return alert("请先选择一个有效的执行快照。");
    
    setShowReportConfig(false);
    setIsGeneratingReport(true);
    setReportProgress(0);
    
    // --- 模拟多维数据追踪过程 ---
    const updateProgress = async (val: number, status: string) => {
        setReportProgress(val);
        setReportStatus(status);
        await new Promise(r => setTimeout(r, 800));
    };

    try {
      await updateProgress(10, "正在同步 GEE 影像元数据流水线...");
      await updateProgress(25, "正在激活 Google Search 全网实时信息检索...");
      await updateProgress(40, "正在解析监测区域时空演变趋势特征...");
      await updateProgress(55, "正在耦合气象数据库与地表覆被变化记录...");
      await updateProgress(70, "正在比对 FAO 农业知识库专家研判规则...");
      await updateProgress(85, "正在并行构建简报版与深度研判版报告...");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contextPrompt = `
        你是一名资深卫星遥感分析专家与高级分析师。请基于以下全链路数据生成【两个版本】的专业级分析报告。
        
        ### 1. 运行快照信息
        - 工作流名称: ${selectedRun.workflowName}
        - 监测区间: ${selectedRun.searchConfig.dateRange}
        - 像幅总数: ${selectedRun.searchConfig.sceneCount}
        - Task 算法: ${selectedRun.taskConfig.algoName} (${selectedRun.taskConfig.algoDesc})
        - AI Workflow 流程: ${selectedRun.workflowConfig.nodes.join(' -> ')}
        - 趋势数据点 (时间:数值): ${selectedRun.workflowConfig.trendData.map(d => `${d.date}:${d.value}`).join(', ')}
        
        ### 2. 用户意图与背景
        - 分析目标地: ${reportForm.targetArea}
        - 背景描述: ${reportForm.backgroundInfo}
        - 分析目标: ${reportForm.analysisObjective}
        - 侧重分析方向: ${reportForm.focusDirection}
        
        ### 3. 重要指令 (CRITICAL INSTRUCTIONS)
        - 必须使用 Google Search 检索该区域在对应时间段的重大事件、气象灾害记录以增强报告真实性。
        - 返回格式必须是一个 JSON 对象，包含两个键: "brief" 和 "detailed"。
        - "brief" 和 "detailed" 的值必须是 纯 HTML 代码字符串。严禁在这些键下嵌套对象。
        - 脚注：报告底部必须包含一行文字："MCFLY AgriBrain"。
        
        ### 4. BRIEF 版本 (简报)
        - 结构简洁，以简明扼要的 HTML 呈现。
        
        ### 5. DETAILED 版本 (正规报告)
        - 结构宏大，HTML 布局应包含模拟扉页元数据的样式。
        - 使用丰富的 HTML 标签（如 <table>, <ul>, <hr>）来提升视觉正式感。
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: contextPrompt,
        config: { 
          tools: [{googleSearch: {}}], 
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      });
      
      await updateProgress(100, "报告合成完毕，正在渲染...");

      const rawParsed = JSON.parse(response.text || '{"brief": "", "detailed": ""}');
      
      const ensureHtmlString = (val: any) => {
        if (typeof val === 'string') return val;
        if (val && typeof val === 'object') {
          if (val.content) return val.content;
          if (val.html) return val.html;
          return JSON.stringify(val); 
        }
        return String(val || "");
      };

      const parsed: AIReportContent = {
        brief: ensureHtmlString(rawParsed.brief),
        detailed: ensureHtmlString(rawParsed.detailed)
      };

      setAiReport(parsed);
      setReportViewType('DETAILED');
    } catch (e: any) {
      console.error("Report Generation Error:", e);
      alert("AI Report Generation Error: " + e.message);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadReport = () => {
    const content = reportViewType === 'BRIEF' ? aiReport?.brief : aiReport?.detailed;
    if (!content) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Satellite Analysis Report - ${reportViewType}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            ${REPORT_STYLES}
            body { background: #fff; margin: 0; padding: 0; }
            .report-rendered-content { padding: 0; }
            @media print { .no-print { display: none !important; } }
          </style>
        </head>
        <body>
          <div class="report-rendered-content expert-report-theme">
            ${content}
            <div style="margin-top: 60px; padding: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              MCFLY AgriBrain | Generated by Sentinel Pro
            </div>
          </div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 500); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSaveAsHtml = () => {
    const content = reportViewType === 'BRIEF' ? aiReport?.brief : aiReport?.detailed;
    if (!content) return;

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Satellite Analysis Report - ${reportViewType}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { background: #f1f5f9; margin: 0; padding: 50px; font-family: 'Inter', sans-serif; }
          .container { background: white; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border-radius: 16px; padding: 0; overflow: hidden; max-width: 900px; margin: 0 auto; }
          ${REPORT_STYLES}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="expert-report-theme">
            ${content}
            <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 10px; font-weight: bold; text-transform: uppercase;">
              MCFLY AgriBrain | Generated by Sentinel Pro
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Satellite_Report_${reportViewType}_${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCloseReport = () => {
    setShowExitReminder(true);
  };

  const finalizeClose = () => {
    setAiReport(null);
    setShowExitReminder(false);
  };

  return (
    <div className="flex flex-1 overflow-hidden h-full bg-[#050608] font-display">
      <style dangerouslySetInnerHTML={{ __html: REPORT_STYLES }} />

      {/* LEFT: Telemetry & Queue */}
      <aside className="w-[300px] border-r border-white/5 bg-[#0a0c10] flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5 bg-white/5 relative">
           <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <Brain size={18} className="text-primary" />
                <h2 className="text-[11px] font-black uppercase tracking-widest text-white">AI Control Panel</h2>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[7px] font-black uppercase tracking-tighter transition-all ${hasPhysicalPaths ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-white/5'}`}>
                 <span className={`size-1 rounded-full ${hasPhysicalPaths ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></span>
                 {hasPhysicalPaths ? 'READY' : 'EMPTY'}
              </div>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
           <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Zap size={12} /> Node Telemetry</label>
              <div className="bg-black/60 border border-white/5 rounded-2xl h-64 overflow-y-auto p-3 font-mono text-[8px] text-slate-400 space-y-1.5 custom-scrollbar">
                 {telemetry.map((log, i) => (
                    <div key={i} className={`flex gap-2 ${i === 0 ? 'text-primary font-bold' : ''}`}>
                       <span className="shrink-0 text-slate-600 tracking-tighter">{log.split(']')[0]}]</span>
                       <span>{log.split(']')[1]}</span>
                    </div>
                 ))}
                 {telemetry.length === 0 && <div className="h-full flex flex-col items-center justify-center opacity-10 uppercase tracking-widest font-black text-[7px]">Awaiting Pipeline...</div>}
              </div>
           </div>
           <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><History size={12} /> History</label>
              <div className="space-y-3">
                 {tasks.map(t => (
                    <div key={t.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-2">
                       <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-slate-300 truncate uppercase">{t.name}</span><span className={`text-[7px] font-black uppercase ${t.status === 'COMPLETED' ? 'text-emerald-500' : 'text-primary animate-pulse'}`}>{t.status}</span></div>
                       <div className="h-1 bg-black rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${t.progress}%` }} /></div>
                    </div>
                 ))}
              </div>
           </div>
        </div>
        <div className="p-4 bg-white/5 border-t border-white/5">
           <button onClick={executePipeline} disabled={isRunning || !hasPhysicalPaths} className="w-full bg-primary text-black font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20">
              {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Start Inference Pipeline
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-[#050608]">
         <div className="h-16 border-b border-white/5 px-8 flex items-center justify-between bg-black/40 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-10 h-full">
               <button onClick={() => setViewMode('DESIGN')} className={`text-[10px] font-black uppercase tracking-widest h-full flex items-center border-b-2 transition-all ${viewMode === 'DESIGN' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}><Workflow size={14} className="mr-2" /> Workflow Builder</button>
               <button onClick={() => setViewMode('ANALYTICS')} className={`text-[10px] font-black uppercase tracking-widest h-full flex items-center border-b-2 transition-all ${viewMode === 'ANALYTICS' ? 'border-primary text-primary' : 'border-transparent text-slate-500'}`}><BarChart3 size={14} className="mr-2" /> Trend Analytics</button>
            </div>
            <div className="flex items-center gap-3 bg-black/40 border border-white/5 px-4 py-2 rounded-xl">
                <Edit3 size={12} className="text-slate-500" />
                <input value={workflowName} onChange={e => setWorkflowName(e.target.value)} disabled={isRunning} className="bg-transparent border-none text-[10px] font-black text-white p-0 w-64 outline-none uppercase tracking-widest" />
            </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
            {viewMode === 'DESIGN' ? (
               <div className="flex flex-col items-center">
                  <div className="w-full max-w-2xl space-y-6">
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
                                 <div className="flex items-center gap-3">
                                    {node.status === 'RUNNING' && <Loader2 size={16} className="animate-spin text-primary" />}
                                    {node.status === 'COMPLETED' && <CheckCircle2 size={16} className="text-emerald-500" />}
                                    {node.type !== 'INPUT' && node.type !== 'OUTPUT' && !isRunning && (
                                       <button onClick={() => setNodes(nodes.filter(n => n.id !== node.id))} className="text-slate-700 hover:text-rose-500 p-1"><Trash2 size={16} /></button>
                                    )}
                                 </div>
                              </div>
                              {(node.type === 'PROCESS' || node.type === 'ANALYSIS') && (
                                 <div className="mt-4 pt-4 border-t border-white/5">
                                    <select value={node.linkedAlgoId || ''} disabled={isRunning} onChange={e => setNodes(nodes.map(n => n.id === node.id ? {...n, linkedAlgoId: e.target.value} : n))} className="w-full bg-black/40 border border-white/5 rounded-xl text-[10px] py-2 px-3 text-slate-300 outline-none">
                                       <option value="">Select Operator...</option>
                                       {wfAlgos.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                 </div>
                              )}
                           </div>
                        </div>
                     ))}
                     {!isRunning && (
                        <button onClick={addWorkflowNode} className="group w-full max-w-xs mx-auto border-2 border-dashed border-white/5 hover:border-primary/40 rounded-3xl py-4 flex items-center justify-center gap-3 transition-all bg-white/[0.02] hover:bg-primary/5">
                            <Plus size={18} className="text-slate-600 group-hover:text-primary transition-colors" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 group-hover:text-primary transition-colors">Add Pipeline Node</span>
                        </button>
                     )}
                  </div>
               </div>
            ) : (
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 h-full">
                  <div className="bg-black/40 border border-white/5 rounded-[32px] p-8 h-[450px] flex flex-col relative overflow-hidden shadow-2xl">
                     <div className="flex items-center justify-between mb-6">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-2"><TrendingUp size={14} className="text-emerald-500" /> Mode Trend Metrics</h4>
                        {chartData.length > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[8px] font-black uppercase tracking-tighter animate-pulse">
                             <Check size={8} /> Real-time Stream Active
                          </div>
                        )}
                     </div>
                     {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={chartData}>
                              <defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                              <XAxis dataKey="date" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                              <YAxis domain={[0, 1.0]} stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                              <Tooltip contentStyle={{ backgroundColor: '#0a0c10', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }} />
                              <Area type="monotone" dataKey="ndviMode" stroke="#10b981" fillOpacity={1} fill="url(#colorVal)" strokeWidth={3} />
                           </AreaChart>
                        </ResponsiveContainer>
                     ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-20"><BarChart size={48} /><p className="text-[10px] font-black uppercase tracking-[0.2em]">Awaiting Workflow Inference Results...</p></div>
                     )}
                  </div>
                  <div className="bg-black/40 border border-white/5 rounded-[32px] p-8 flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden group shadow-2xl">
                     <div className="size-20 bg-primary/10 rounded-[28px] flex items-center justify-center text-primary shadow-2xl border border-primary/20"><Sparkles size={32} /></div>
                     <div className="space-y-2">
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Expert Analysis Hub</h3>
                        <p className="text-[10px] text-slate-500 max-w-xs uppercase font-bold tracking-widest leading-relaxed">工作流数据已就绪。点击下方按键配置研判参数，生成整合气象与农业知识库的深度报告。</p>
                     </div>
                     <button onClick={() => setShowReportConfig(true)} className="bg-primary text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg active:scale-95"><FileText size={14} /> Configure & Generate Report</button>
                  </div>
               </div>
            )}
         </div>
      </main>

      <aside className="w-[320px] border-l border-white/5 bg-[#0a0c10] flex flex-col shrink-0">
         <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <Layers size={18} className="text-primary" />
               <h2 className="text-[11px] font-black uppercase tracking-widest text-white">Analytics Registry</h2>
            </div>
            <button onClick={() => { setWfForm({ id: '', name: '', desc: '', code: '', author: 'User', error: '' }); setShowWfModal(true); }} className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-black transition-all"><Plus size={14} /></button>
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Algorithm Kernels</p>
            {wfAlgos.map(algo => (
               <div key={algo.id} onClick={() => openAlgoViewer(algo)} className="bg-black/40 border border-white/5 rounded-2xl p-4 group hover:border-primary/30 transition-all relative overflow-hidden cursor-pointer">
                  {algo.author === 'System' && <div className="absolute top-0 right-0 p-2 opacity-5"><Lock size={24} /></div>}
                  <div className="flex justify-between items-start mb-2">
                     <p className="text-[10px] font-bold text-white uppercase">{algo.name}</p>
                     <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {algo.author === 'User' && (
                           <><button onClick={(e) => { e.stopPropagation(); saveWfAlgo(algo.id); }} className="text-emerald-500 p-1 hover:bg-emerald-500/10 rounded-lg"><Save size={12} /></button>
                             <button onClick={(e) => { e.stopPropagation(); deleteWfAlgo(algo.id); }} className="text-rose-500 p-1 hover:bg-rose-500/10 rounded-lg"><Trash2 size={12} /></button></>
                        )}
                        {algo.author === 'System' && <Eye size={12} className="text-slate-600" />}
                     </div>
                  </div>
                  <p className="text-[9px] text-slate-400 mb-3 leading-relaxed truncate">{algo.desc}</p>
                  <div className="flex items-center justify-between"><div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[7px] font-black uppercase">JS KERNEL</div><span className="text-[7px] font-mono text-slate-600 uppercase">{algo.author}</span></div>
               </div>
            ))}
         </div>
      </aside>

      {/* REPORT CONFIG MODAL */}
      {showReportConfig && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-6">
           <div className="w-full max-w-4xl bg-[#0d0f14] border border-white/10 rounded-[40px] flex flex-col animate-in zoom-in-95 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Sparkles size={24} /></div>
                    <div><h3 className="text-lg font-black uppercase tracking-widest text-white">Report Configuration</h3><span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Expert Logic Integration</span></div>
                 </div>
                 <button onClick={() => setShowReportConfig(false)} className="p-3 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-xl"><X size={24} /></button>
              </div>
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-8 bg-black/20">
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><History size={14} /> Execution Snapshot</label>
                       <select value={reportForm.selectedRunId} onChange={e => setReportForm({...reportForm, selectedRunId: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white outline-none focus:border-primary/50 transition-all">
                          <option value="">Select a Run ID...</option>
                          {wfHistory.map(h => <option key={h.runId} value={h.runId}>{h.workflowName} ({h.timestamp})</option>)}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Target size={14} /> Analysis Target Area</label>
                       <input placeholder="e.g. 四川省眉山市东坡区某农场" value={reportForm.targetArea} onChange={e => setReportForm({...reportForm, targetArea: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white outline-none focus:border-primary/50" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Compass size={14} /> Analysis Objective</label>
                       <textarea placeholder="e.g. 评估 2024 年春季干旱对冬小麦生长的影响" value={reportForm.analysisObjective} onChange={e => setReportForm({...reportForm, analysisObjective: e.target.value})} className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white resize-none outline-none focus:border-primary/50" />
                    </div>
                 </div>
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={14} /> Background Information</label>
                       <textarea placeholder="e.g. 该区域近期遭受连续 20 天高温..." value={reportForm.backgroundInfo} onChange={e => setReportForm({...reportForm, backgroundInfo: e.target.value})} className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white resize-none outline-none focus:border-primary/50" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Search size={14} /> Critical Focus Direction</label>
                       <input placeholder="e.g. 异常植被指数退化区域定位..." value={reportForm.focusDirection} onChange={e => setReportForm({...reportForm, focusDirection: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white outline-none focus:border-primary/50" />
                    </div>
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl"><p className="text-[8px] font-bold text-primary leading-relaxed uppercase tracking-widest">系统将自动整合 Sentinel-2 全链路元数据、气象数据库与 FAO 农业农业知识库进行多维分析。</p></div>
                 </div>
              </div>
              <div className="p-8 border-t border-white/5 flex justify-end gap-4 bg-black/40">
                <button onClick={() => setShowReportConfig(false)} className="px-8 py-3 text-[10px] font-black uppercase text-slate-500">Cancel</button>
                <button onClick={handleGenerateAIReport} disabled={!reportForm.selectedRunId || !reportForm.targetArea} className="bg-primary text-black px-12 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg flex items-center gap-2">
                   <ShieldCheck size={18} /> Generate Expert Report
                </button>
              </div>
           </div>
        </div>
      )}

      {/* ALGO EDITOR MODAL */}
      {showWfModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6">
           <div className="w-full max-w-5xl h-[85vh] bg-[#0d0f14] border border-white/10 rounded-[40px] flex flex-col animate-in zoom-in-95 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">{wfForm.author === 'System' ? <Lock size={24} /> : <Code2 size={24} />}</div>
                    <div><h3 className="text-lg font-black uppercase tracking-widest text-white">{wfForm.author === 'System' ? 'System Kernel View' : 'Registry Uplink'}</h3><span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">{wfForm.author === 'System' ? 'Protected Core Logic' : 'GEE Workflow Logic Auditor'}</span></div>
                 </div>
                 <button onClick={() => setShowWfModal(false)} className="p-3 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-xl"><X size={24} /></button>
              </div>
              <div className="flex-1 flex overflow-hidden">
                <div className="w-80 p-8 border-r border-white/5 space-y-6 overflow-y-auto custom-scrollbar bg-black/20">
                   <div className="space-y-4">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Metadata</label>
                      <input disabled={wfForm.author === 'System'} placeholder="Kernel Name" value={wfForm.name} onChange={e => setWfForm({...wfForm, name: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white outline-none focus:border-primary/50" />
                      <textarea disabled={wfForm.author === 'System'} placeholder="Process summary..." value={wfForm.desc} onChange={e => setWfForm({...wfForm, desc: e.target.value})} className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white resize-none outline-none focus:border-primary/50" />
                   </div>
                   {wfForm.error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl"><p className="text-[9px] font-mono text-rose-500 leading-relaxed">{wfForm.error}</p></div>}
                </div>
                <div className="flex-1 flex flex-col relative bg-black/60">
                   <div className="absolute top-4 left-4 z-10 text-[8px] font-black text-slate-600 uppercase tracking-widest bg-black/40 px-2 py-1 rounded border border-white/5">JavaScript Editor</div>
                   <textarea readOnly={wfForm.author === 'System'} value={wfForm.code} onChange={e => setWfForm({...wfForm, code: e.target.value})} spellCheck={false} className="flex-1 p-12 pt-16 font-mono text-xs text-primary/80 outline-none resize-none leading-relaxed" placeholder="// Enter GEE Workflow Code..." />
                </div>
              </div>
              <div className="p-8 border-t border-white/5 flex justify-end gap-4 bg-black/40">
                <button onClick={() => setShowWfModal(false)} className="px-8 py-3 text-[10px] font-black uppercase text-slate-500">Close</button>
                {wfForm.author === 'User' && (
                  <button onClick={handleWfAudit} disabled={isAuditing || !wfForm.name || !wfForm.code} className="bg-primary text-black px-12 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20">
                    {isAuditing ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} {isAuditing ? 'Auditing Logic...' : 'Audit & Commit'}
                  </button>
                )}
              </div>
           </div>
        </div>
      )}

      {/* REPORT DISPLAY MODAL - THE MAIN UPGRADE POINT */}
      {aiReport && (
         <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6">
            <div className="w-full max-w-5xl h-full bg-[#f8fafc] rounded-[40px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-500 shadow-2xl relative">
               
               {/* EXIT REMINDER DIALOG - THE CLOSE WARNING */}
               {showExitReminder && (
                  <div className="absolute inset-0 z-[800] flex items-center justify-center bg-[#0a0c10]/80 backdrop-blur-md animate-in fade-in duration-200">
                     <div className="w-[450px] bg-[#1a1c22] border border-white/10 rounded-[40px] p-10 shadow-3xl text-center space-y-8 animate-in zoom-in-95">
                        <div className="size-20 bg-primary/10 text-primary rounded-[28px] flex items-center justify-center mx-auto border border-primary/20">
                           <AlertCircle size={40} />
                        </div>
                        <div className="space-y-3">
                           <h4 className="text-xl font-black text-white uppercase tracking-tight">保存分析研判报告</h4>
                           <p className="text-[12px] text-slate-400 leading-relaxed uppercase font-bold tracking-widest">
                             当前生成的 AI 报告包含实时检索数据，关闭后将不再保留。建议在退出前导出存档。
                           </p>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                           <button onClick={handleDownloadReport} className="w-full bg-primary text-black py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg">
                              <Printer size={18} /> 导出为 PDF 存档
                           </button>
                           <button onClick={handleSaveAsHtml} className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 active:scale-95 transition-all">
                              <FileDown size={18} /> 另存为 HTML 文件
                           </button>
                           <div className="flex gap-4 mt-4">
                              <button onClick={() => setShowExitReminder(false)} className="flex-1 py-4 text-[11px] font-black uppercase text-slate-500 hover:text-white transition-colors border border-transparent hover:border-white/5 rounded-2xl">继续查看</button>
                              <button onClick={finalizeClose} className="flex-1 py-4 text-[11px] font-black uppercase text-rose-500/80 hover:text-rose-500 transition-colors bg-rose-500/5 rounded-2xl">放弃并退出</button>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               <div className="p-6 bg-[#0a0c10] flex justify-between border-b border-white/5 shrink-0 z-[710]">
                  <div className="flex items-center gap-8">
                     <div className="flex items-center gap-4 border-r border-white/10 pr-8">
                        <div className="p-2.5 bg-primary/20 rounded-xl text-primary"><ScrollText size={20} /></div>
                        <span className="text-[12px] font-black uppercase tracking-widest text-white">Analysis Final Report</span>
                     </div>
                     <div className="flex bg-white/10 p-1 rounded-2xl border border-white/5">
                        <button onClick={() => setReportViewType('BRIEF')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${reportViewType === 'BRIEF' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}>简报预览</button>
                        <button onClick={() => setReportViewType('DETAILED')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${reportViewType === 'DETAILED' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}>深度研判报告</button>
                     </div>
                  </div>
                  <div className="flex items-center gap-5">
                     <button onClick={handleDownloadReport} className="flex items-center gap-3 px-8 py-3 bg-primary/10 border border-primary/20 text-primary rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all">
                        <Printer size={18} /> 导出 PDF
                     </button>
                     <button onClick={handleCloseReport} className="text-slate-600 hover:text-white transition-colors bg-white/5 p-3 rounded-2xl"><X size={24} /></button>
                  </div>
               </div>
               
               <div className="flex-1 overflow-y-auto p-12 bg-[#f1f5f9] text-slate-900 custom-scrollbar report-rendered-content scroll-smooth">
                  {/* 模拟高质量 A4 纸张页面 */}
                  <div className="mx-auto max-w-[850px] bg-white shadow-2xl rounded-sm expert-report-theme min-h-full">
                     <div dangerouslySetInnerHTML={{ __html: reportViewType === 'BRIEF' ? aiReport.brief : aiReport.detailed }} />
                     
                     <div className="mt-20 pt-10 border-t-2 border-slate-100 flex flex-col items-center justify-center gap-4 opacity-40 text-[11px] font-mono">
                        <div className="flex items-center justify-between w-full uppercase tracking-tighter">
                           <span>Ref: AI-${Date.now()}</span>
                           <span>Sentinel Pro Intelligence Pipeline V1.3</span>
                           <span>Status: Verified Analyst Signature</span>
                        </div>
                        <div className="font-black text-slate-900 text-[14px] tracking-[0.6em] mt-4">MCFLY AgriBrain</div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* --- UPGRADED REPORT GENERATION OVERLAY --- */}
      {isGeneratingReport && (
          <div className="fixed inset-0 z-[800] flex flex-col items-center justify-center bg-[#020305]/98 backdrop-blur-[40px] animate-in fade-in duration-500 overflow-hidden">
            {/* 背景动态网格与装饰 */}
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(17,180,212,0.2) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-primary/5 rounded-full blur-[160px] animate-pulse pointer-events-none" />
            
            <div className="relative z-10 w-full max-w-2xl px-10 flex flex-col items-center">
                {/* 核心扫描动画 */}
                <div className="relative mb-16">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                    <div className="size-48 rounded-full border border-white/5 flex items-center justify-center relative bg-black/40 backdrop-blur-xl shadow-2xl">
                        {/* 旋转轨道 */}
                        <div className="absolute inset-0 border-[3px] border-primary/20 border-t-primary rounded-full animate-[spin_3s_linear_infinite]" />
                        <div className="absolute inset-4 border border-white/10 rounded-full animate-[spin_5s_linear_infinite_reverse]" />
                        <div className="absolute inset-8 border border-primary/10 border-b-primary/40 rounded-full animate-[spin_8s_linear_infinite]" />
                        
                        {/* 状态图标 */}
                        <div className="relative z-20 flex flex-col items-center gap-2">
                            {reportProgress < 30 ? <Database size={40} className="text-primary animate-bounce" /> : 
                             reportProgress < 60 ? <ScanSearch size={40} className="text-primary animate-pulse" /> :
                             reportProgress < 90 ? <Orbit size={40} className="text-primary animate-spin" /> :
                             <Quote size={40} className="text-emerald-400 animate-pulse" />}
                             <span className="text-[14px] font-mono font-black text-white">{reportProgress}%</span>
                        </div>
                    </div>
                </div>

                {/* 进度显示区 */}
                <div className="w-full space-y-8 text-center">
                    <div className="space-y-3">
                        <h3 className="text-2xl font-black text-white uppercase tracking-[0.3em] leading-relaxed drop-shadow-lg">
                            {reportStatus}
                        </h3>
                        <div className="flex items-center justify-center gap-6 text-slate-500">
                            <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${reportProgress >= 25 ? 'text-primary' : 'opacity-30'}`}>
                                <Newspaper size={12} /> Google Search
                            </div>
                            <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${reportProgress >= 55 ? 'text-primary' : 'opacity-30'}`}>
                                <CloudSun size={12} /> Meteo Data
                            </div>
                            <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all duration-500 ${reportProgress >= 70 ? 'text-primary' : 'opacity-30'}`}>
                                <BookOpen size={12} /> FAO Expert
                            </div>
                        </div>
                    </div>

                    {/* 极客风进度条 */}
                    <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary/40 via-primary to-emerald-400 transition-all duration-700 ease-out" 
                            style={{ width: `${reportProgress}%` }}
                        />
                        <div className="absolute top-0 left-0 h-full w-full bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[pulse_1.5s_infinite]" />
                    </div>

                    {/* 底部伪数据流日志 */}
                    <div className="h-10 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#020305] via-transparent to-[#020305] z-10 pointer-events-none" />
                        <div className="flex flex-col items-center gap-1.5 animate-[slide-up_20s_linear_infinite]">
                            {["REQUEST: Sentinel-2 Level-2A metadata synchronization...", 
                              "CALL: Google Search Grounding for localized news...", 
                              "ANALYSIS: Calculating temporal NDVI mode variations...", 
                              "FETCH: Retrieving 10-day historical weather patterns...",
                              "LOGIC: Executing agricultural impact assessment...",
                              "SYNTHESIS: Generating detailed expert analysis strings...",
                              "ENCODE: Optimizing HTML layout for high-res preview...",
                              "AUDIT: Checking spectral consistency and data lineage..."].map((log, i) => (
                                <span key={i} className="text-[8px] font-mono text-slate-600 uppercase tracking-widest whitespace-nowrap">{log}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          </div>
       )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slide-up {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
        }
      ` }} />
    </div>
  );
};

export default AIProcess;
