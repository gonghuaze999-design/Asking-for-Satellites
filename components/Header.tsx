
import React, { useState, useEffect } from 'react';
import { Search, ClipboardList, Terminal, Satellite, BrainCircuit, Clock, Radio } from 'lucide-react';
import { AppTab } from '../types';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const [beijingTime, setBeijingTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const parts = formatter.formatToParts(now);
      const d = parts.find(p => p.type === 'day')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const y = parts.find(p => p.type === 'year')?.value;
      const hh = parts.find(p => p.type === 'hour')?.value;
      const mm = parts.find(p => p.type === 'minute')?.value;
      const ss = parts.find(p => p.type === 'second')?.value;
      
      setBeijingTime(`${y}-${m}-${d} ${hh}:${mm}:${ss}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { id: AppTab.DATA_SEARCH, label: 'Data Search', icon: <Search size={16} /> },
    { id: AppTab.TASK_MANAGEMENT, label: 'Task Management', icon: <ClipboardList size={16} /> },
    { id: AppTab.AI_PROCESS, label: 'AI Process', icon: <BrainCircuit size={16} /> },
    { id: AppTab.API_CONSOLE, label: 'API Console', icon: <Terminal size={16} /> },
  ];

  return (
    <header className="h-16 border-b border-border-dark bg-[#0a0c10] px-6 flex items-center justify-between z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(17,180,212,0.4)]">
            <Satellite size={20} className="text-background-dark font-bold" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-black tracking-tight leading-none text-white uppercase">
              Satellites Get
            </h1>
            <span className="text-primary font-bold text-[9px] uppercase tracking-[0.2em] mt-0.5">Mission Control Pro</span>
          </div>
        </div>
        
        <nav className="hidden lg:flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                activeTab === item.id 
                  ? 'text-primary bg-primary/10 shadow-inner' 
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Right side group: Tactical Link & Beijing Time */}
      <div className="flex items-center">
        {/* Tactical Link Info */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="block size-2 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></span>
            <span className="absolute inset-0 block size-2 bg-emerald-500 rounded-full animate-ping opacity-75"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-black text-slate-300 leading-none">Tactical Link Online</span>
            <span className="text-[8px] font-mono text-emerald-500 uppercase tracking-tighter mt-1">S-Band Connection Active</span>
          </div>
        </div>

        {/* Separator line */}
        <div className="h-8 w-px bg-white/10 mx-6"></div>

        {/* Beijing Time Display */}
        <div className="flex flex-col items-end min-w-[180px]">
          <span className="text-[14px] font-mono font-black text-white tracking-widest tabular-nums leading-none">
            {beijingTime}
          </span>
          <div className="flex items-center gap-1.5 mt-1 opacity-50">
             <Radio size={10} className="text-primary" />
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">CST BEIJING</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
