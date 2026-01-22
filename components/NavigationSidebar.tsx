
import React from 'react';
import { Compass, Layers, BarChart2, HelpCircle } from 'lucide-react';
import { AppTab } from '../types';

interface NavigationSidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="w-16 border-r border-border-dark flex flex-col items-center py-6 gap-8 bg-background-dark shrink-0">
      <button 
        onClick={() => setActiveTab(AppTab.DATA_SEARCH)}
        className={`p-3 rounded-xl transition-all ${
          activeTab === AppTab.DATA_SEARCH 
            ? 'text-primary bg-primary/10' 
            : 'text-slate-500 hover:text-white hover:bg-panel-dark'
        }`}
      >
        <Compass size={24} />
      </button>
      <button 
        onClick={() => setActiveTab(AppTab.TASK_MANAGEMENT)}
        className={`p-3 rounded-xl transition-all ${
          activeTab === AppTab.TASK_MANAGEMENT 
            ? 'text-primary bg-primary/10' 
            : 'text-slate-500 hover:text-white hover:bg-panel-dark'
        }`}
      >
        <Layers size={24} />
      </button>
      <button 
        onClick={() => setActiveTab(AppTab.API_CONSOLE)}
        className={`p-3 rounded-xl transition-all ${
          activeTab === AppTab.API_CONSOLE 
            ? 'text-primary bg-primary/10' 
            : 'text-slate-500 hover:text-white hover:bg-panel-dark'
        }`}
      >
        <BarChart2 size={24} />
      </button>
      
      <button className="p-3 text-slate-500 hover:text-white hover:bg-panel-dark rounded-xl transition-all mt-auto">
        <HelpCircle size={24} />
      </button>
    </aside>
  );
};

export default NavigationSidebar;
