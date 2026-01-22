
import React from 'react';
import { Search, ClipboardList, Terminal, Settings, Satellite } from 'lucide-react';
import { AppTab } from '../types';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: AppTab.DATA_SEARCH, label: 'Data Search', icon: <Search size={16} /> },
    { id: AppTab.TASK_MANAGEMENT, label: 'Task Management', icon: <ClipboardList size={16} /> },
    { id: AppTab.API_CONSOLE, label: 'API Console', icon: <Terminal size={16} /> },
  ];

  return (
    <header className="h-16 border-b border-border-dark bg-background-dark px-6 flex items-center justify-between z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded-lg flex items-center justify-center">
            <Satellite size={20} className="text-background-dark font-bold" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            SATELLITE <span className="text-primary font-light">WORKBENCH</span>
          </h1>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`text-sm font-medium flex items-center gap-2 transition-colors ${
                activeTab === item.id ? 'text-primary' : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-panel-dark px-3 py-1.5 rounded-lg border border-border-dark">
          <span className="size-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">System Ready</span>
        </div>
        <button className="p-2 hover:bg-panel-dark rounded-lg transition-colors border border-transparent hover:border-border-dark">
          <Settings size={18} className="text-slate-400" />
        </button>
        <div className="size-10 rounded-full border border-primary/30 p-0.5">
          <div 
            className="size-full rounded-full bg-cover bg-center" 
            style={{ backgroundImage: `url('https://picsum.photos/seed/user123/100/100')` }}
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
