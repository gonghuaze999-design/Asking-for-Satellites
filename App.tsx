
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import NavigationSidebar from './components/NavigationSidebar';
import DataSearch from './views/DataSearch';
import TaskManagement from './views/TaskManagement';
import AIProcess from './views/AIProcess';
import ApiConsole from './views/ApiConsole';
import UserGuide from './components/UserGuide';
import { AppTab, Task, LogEntry, SatelliteResult, AIWorkflowNode, AIProcessTask } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DATA_SEARCH);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchResults, setSearchResults] = useState<SatelliteResult[]>([]);
  const [currentRoi, setCurrentRoi] = useState<any>(null);
  const [showGuide, setShowGuide] = useState(false);

  // --- AI PROCESS PERSISTENT STATE ---
  const [aiTasks, setAiTasks] = useState<AIProcessTask[]>(() => {
    const saved = localStorage.getItem('SENTINEL_AI_TASKS');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [aiViewMode, setAiViewMode] = useState<'DESIGN' | 'ANALYTICS'>(() => {
    return (localStorage.getItem('SENTINEL_AI_VIEW_MODE') as any) || 'DESIGN';
  });

  const [aiWorkflowName, setAiWorkflowName] = useState(() => {
    return localStorage.getItem('SENTINEL_AI_WF_NAME') || 'Sentinel_VegMode_Inference';
  });

  // 持久化的 AI 遥测日志和计算结果
  const [aiTelemetry, setAiTelemetry] = useState<string[]>([]);
  const [aiWorkflowResults, setAiWorkflowResults] = useState<Record<string, number>>({});
  
  const defaultAiOutputPath = useMemo(() => {
    const firstLocal = searchResults.find(d => !!d.localPath);
    if (firstLocal) {
        return firstLocal.localPath.split('/').slice(0, -1).join('/') + '/AI_Results/';
    }
    return 'Downloads/Sentinel_AI_Workspace/';
  }, [searchResults]);

  const [aiNodes, setAiNodes] = useState<AIWorkflowNode[]>(() => {
    const saved = localStorage.getItem('SENTINEL_AI_NODES');
    if (saved) return JSON.parse(saved);
    return [
      { id: 'node_input', label: 'Imagery Sequence Input', type: 'INPUT', status: 'COMPLETED' },
      { id: 'node_veg_extract', label: 'NDVI Masker (>0.4)', type: 'PROCESS', status: 'IDLE', linkedAlgoId: 'veg_mask' },
      { id: 'node_hist', label: 'Histogram Mode Extraction', type: 'ANALYSIS', status: 'IDLE' },
      { id: 'node_output', label: 'Report Delivery Unit', type: 'OUTPUT', status: 'IDLE', customOutputPath: defaultAiOutputPath }
    ];
  });

  // 同步状态到本地存储
  useEffect(() => {
    localStorage.setItem('SENTINEL_AI_TASKS', JSON.stringify(aiTasks));
    localStorage.setItem('SENTINEL_AI_NODES', JSON.stringify(aiNodes));
    localStorage.setItem('SENTINEL_AI_VIEW_MODE', aiViewMode);
    localStorage.setItem('SENTINEL_AI_WF_NAME', aiWorkflowName);
  }, [aiTasks, aiNodes, aiViewMode, aiWorkflowName]);

  const addLog = useCallback((level: LogEntry['level'], message: string, payload?: any) => {
    const newLog: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      payload
    };
    setLogs(prev => [...prev.slice(-99), newLog]);
  }, []);

  const addTask = useCallback((name: string, type: string): string => {
    const id = `GE-${Math.floor(Math.random() * 100000)}`;
    const newTask: Task = {
      id,
      name,
      type,
      status: 'RUNNING',
      progress: 0,
      startTime: new Date().toLocaleString(),
      estRemaining: 'calculating...'
    };
    setTasks(prev => [newTask, ...prev]);
    addLog('INFO', `Dispatched task: ${name}`, { id, type });
    return id;
  }, [addLog]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.DATA_SEARCH:
        return (
          <DataSearch 
            addTask={addTask} 
            addLog={addLog} 
            setResults={setSearchResults} 
            results={searchResults} 
            onRoiChange={setCurrentRoi}
          />
        );
      case AppTab.TASK_MANAGEMENT:
        return (
          <TaskManagement 
            tasks={tasks} 
            inputData={searchResults} 
            currentRoi={currentRoi}
            addTask={addTask}
            updateTask={updateTask}
            setResults={setSearchResults}
            setActiveTab={setActiveTab}
          />
        );
      case AppTab.AI_PROCESS:
        return (
          <AIProcess 
            inputData={searchResults} 
            tasks={aiTasks}
            setTasks={setAiTasks}
            nodes={aiNodes}
            setNodes={setAiNodes}
            viewMode={aiViewMode}
            setViewMode={setAiViewMode}
            workflowName={aiWorkflowName}
            setWorkflowName={setAiWorkflowName}
            defaultOutputPath={defaultAiOutputPath}
            telemetry={aiTelemetry}
            setTelemetry={setAiTelemetry}
            workflowResults={aiWorkflowResults}
            setWorkflowResults={setAiWorkflowResults}
          />
        );
      case AppTab.API_CONSOLE:
        return <ApiConsole logs={logs} addLog={addLog} />;
      default:
        return <DataSearch addTask={addTask} addLog={addLog} setResults={setSearchResults} results={searchResults} onRoiChange={setCurrentRoi} />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background-dark text-slate-100">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex flex-1 overflow-hidden">
        <NavigationSidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onOpenGuide={() => setShowGuide(true)}
        />
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {renderContent()}
        </main>
      </div>
      {showGuide && <UserGuide onClose={() => setShowGuide(false)} />}
    </div>
  );
};

export default App;
