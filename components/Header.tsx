
import React from 'react';
import { Search, ClipboardList, Terminal, Satellite, BrainCircuit } from 'lucide-react';
import { AppTab } from '../types';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: AppTab.DATA_SEARCH, label: 'Data Search', icon: <Search size={16} /> },
    { id: AppTab.TASK_MANAGEMENT, label: 'Task Management', icon: <ClipboardList size={16} /> },
    { id: AppTab.AI_PROCESS, label: 'AI Process', icon: <BrainCircuit size={16} /> },
    { id: AppTab.API_CONSOLE, label: 'API Console', icon: <Terminal size={16} /> },
  ];

  return (
    <header className="h-16 border-b border-border-dark bg-background-dark px-6 flex items-center justify-between z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(17,180,212,0.4)]">
            <Satellite size={20} className="text-background-dark font-bold" />
          </div>
          <h1 className="text-lg font-black tracking-tight leading-none">
            SATELLITES GET <br/>
            <span className="text-primary font-light text-xs uppercase tracking-[0.2em]">AI PROCESS PRO</span>
          </h1>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
                activeTab === item.id ? 'text-primary' : 'text-slate-500 hover:text-white'
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
          <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>
          <span className="text-[9px] uppercase tracking-widest font-black text-slate-400">Tactical Link Online</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
