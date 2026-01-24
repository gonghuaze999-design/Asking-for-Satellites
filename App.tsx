
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import NavigationSidebar from './components/NavigationSidebar';
import DataSearch from './views/DataSearch';
import TaskManagement from './views/TaskManagement';
import ApiConsole from './views/ApiConsole';
import { AppTab, Task, LogEntry, SatelliteResult } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DATA_SEARCH);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchResults, setSearchResults] = useState<SatelliteResult[]>([]);
  const [currentRoi, setCurrentRoi] = useState<any>(null);

  const addLog = useCallback((level: LogEntry['level'], message: string, payload?: any) => {
    const newLog: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
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

  // Task Progress Simulation for non-instant tasks
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prev => prev.map(task => {
        if (task.status !== 'RUNNING' || task.progress >= 100) return task;
        
        // Slightly random progress
        const newProgress = Math.min(task.progress + Math.random() * 8, 99);
        
        return {
          ...task,
          progress: newProgress,
          estRemaining: `~${Math.ceil((100 - newProgress) / 5)}m`
        };
      }));
    }, 2000);
    return () => clearInterval(interval);
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
            setActiveTab={setActiveTab}
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
        <NavigationSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
