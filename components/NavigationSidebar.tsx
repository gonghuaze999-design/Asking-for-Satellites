
import React from 'react';
import { Compass, Layers, BarChart2, HelpCircle, BrainCircuit } from 'lucide-react';
import { AppTab } from '../types';

interface NavigationSidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="w-16 border-r border-border-dark flex flex-col items-center py-6 gap-6 bg-background-dark shrink-0">
      <button 
        onClick={() => setActiveTab(AppTab.DATA_SEARCH)}
        className={`p-3 rounded-xl transition-all ${
          activeTab === AppTab.DATA_SEARCH 
            ? 'text-primary bg-primary/10 shadow-[0_0_10px_rgba(17,180,212,0.1)]' 
            : 'text-slate-600 hover:text-white hover:bg-panel-dark'
        }`}
        title="Data Search"
      >
        <Compass size={22} />
      </button>
      <button 
        onClick={() => setActiveTab(AppTab.TASK_MANAGEMENT)}
        className={`p-3 rounded-xl transition-all ${
          activeTab === AppTab.TASK_MANAGEMENT 
            ? 'text-primary bg-primary/10 shadow-[0_0_10px_rgba(17,180,212,0.1)]' 
            : 'text-slate-600 hover:text-white hover:bg-panel-dark'
        }`}
        title="Task Management"
      >
        <Layers size={22} />
      </button>
      <button 
        onClick={() => setActiveTab(AppTab.AI_PROCESS)}
        className={`p-3 rounded-xl transition-all ${
          activeTab === AppTab.AI_PROCESS 
            ? 'text-primary bg-primary/10 shadow-[0_0_10px_rgba(17,180,212,0.1)]' 
            : 'text-slate-600 hover:text-white hover:bg-panel-dark'
        }`}
        title="AI Processing"
      >
        <BrainCircuit size={22} />
      </button>
      <button 
        onClick={() => setActiveTab(AppTab.API_CONSOLE)}
        className={`p-3 rounded-xl transition-all ${
          activeTab === AppTab.API_CONSOLE 
            ? 'text-primary bg-primary/10 shadow-[0_0_10px_rgba(17,180,212,0.1)]' 
            : 'text-slate-600 hover:text-white hover:bg-panel-dark'
        }`}
        title="API Console"
      >
        <BarChart2 size={22} />
      </button>
      
      <button className="p-3 text-slate-700 hover:text-white hover:bg-panel-dark rounded-xl transition-all mt-auto">
        <HelpCircle size={22} />
      </button>
    </aside>
  );
};

export default NavigationSidebar;
