
import React, { useState, useEffect, useRef } from 'react';
import { Search, ClipboardList, Terminal, Satellite, Upload } from 'lucide-react';
import { AppTab } from '../types';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const [customBadge, setCustomBadge] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navItems = [
    { id: AppTab.DATA_SEARCH, label: 'Data Search', icon: <Search size={16} /> },
    { id: AppTab.TASK_MANAGEMENT, label: 'Task Management', icon: <ClipboardList size={16} /> },
    { id: AppTab.API_CONSOLE, label: 'API Console', icon: <Terminal size={16} /> },
  ];

  useEffect(() => {
    const saved = localStorage.getItem('WORKBENCH_CUSTOM_BADGE');
    if (saved) setCustomBadge(saved);
  }, []);

  const handleBadgeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setCustomBadge(result);
        localStorage.setItem('WORKBENCH_CUSTOM_BADGE', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

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
        
        {/* Custom Badge Uploader (Replaces Avatar) */}
        <div 
            onClick={triggerUpload}
            className="group relative size-10 rounded-full border border-primary/30 p-0.5 cursor-pointer hover:border-primary transition-all"
            title="Upload Custom Badge/Logo"
        >
          <div 
            className="size-full rounded-full bg-cover bg-center bg-no-repeat flex items-center justify-center bg-panel-dark overflow-hidden" 
            style={{ backgroundImage: customBadge ? `url('${customBadge}')` : 'none' }}
          >
             {!customBadge && <span className="text-[8px] font-black text-slate-500">LOGO</span>}
          </div>
          
          {/* Overlay on Hover */}
          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
             <Upload size={12} className="text-white" />
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleBadgeUpload} 
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
