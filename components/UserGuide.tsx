import React from 'react';
import { Download, Compass, Layers, BrainCircuit, Terminal, BookOpen, Satellite, Target, Cpu, ShieldCheck, Mail, Database, Info, Sparkles, AlertCircle, ArrowRight, Activity } from 'lucide-react';

interface UserGuideProps {
  onClose: () => void;
}

const UserGuide: React.FC<UserGuideProps> = ({ onClose }) => {
  const handleDownloadManual = () => {
    // 构造与应用内完全一致的 1:1 还原 HTML，包含完整的 Tailwind 支持与品牌信息
    const guideHtml = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SATELLITES GET - 官方操作指南 (SNAPSHOT)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Space Grotesk', sans-serif; background-color: #050608; color: #f1f5f9; }
        .bg-primary { background-color: #11b4d4; }
        .text-primary { color: #11b4d4; }
        .border-primary { border-color: #11b4d4; }
        .glass { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2d323d; border-radius: 10px; }
    </style>
</head>
<body class="p-4 md:p-12 leading-relaxed antialiased">
    <div class="max-w-5xl mx-auto space-y-20">
        <!-- Header -->
        <header class="text-center space-y-6 pt-10">
            <div class="inline-flex p-4 bg-primary rounded-3xl shadow-[0_0_50px_rgba(17,180,212,0.3)] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="m17 2 4 4-4 4"/><path d="m7 22-4-4 4-4"/><path d="M21 6H12a2 2 0 0 0-2 2v10a2 2 0 0 1-2 2H3"/></svg>
            </div>
            <h1 class="text-6xl font-black uppercase tracking-tighter">SATELLITES <span class="text-primary">GET</span></h1>
            <p class="text-slate-500 font-mono text-sm uppercase tracking-[0.4em]">Official Operational Blueprint V1.5</p>
            <div class="flex justify-center gap-4 pt-4">
                <span class="px-4 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-slate-400">Stable Snapshot</span>
                <span class="px-4 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black uppercase text-primary">Mission Documentation</span>
            </div>
        </header>

        <!-- Critical Workflow -->
        <section class="glass p-10 rounded-[40px] border-primary/20 bg-primary/[0.02]">
            <h3 class="text-xl font-black uppercase tracking-widest text-white mb-6 flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#11b4d4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4-4-4"/><path d="M3 3v18h18"/><path d="M12 14V3"/></svg>
                核心流水线执行准则 (Mandatory Workflow)
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                <div class="space-y-3">
                    <div class="text-primary font-black text-2xl">01</div>
                    <p class="text-[11px] font-black uppercase text-white">Data Search</p>
                    <p class="text-[10px] text-slate-500 leading-relaxed">锁定 ROI 区域并索引 Sentinel-2 影像元数据。</p>
                </div>
                <div class="space-y-3">
                    <div class="text-slate-700 font-black text-2xl">02</div>
                    <p class="text-[11px] font-black uppercase text-white">Task Management</p>
                    <p class="text-[10px] text-slate-500 leading-relaxed">注入算法并执行数据合成导出任务。</p>
                </div>
                <div class="space-y-3">
                    <div class="text-slate-700 font-black text-2xl">03</div>
                    <p class="text-[11px] font-black uppercase text-white">AI Process</p>
                    <p class="text-[10px] text-slate-500 leading-relaxed">基于导出的数据流进行深度研判与报告合成。</p>
                </div>
                <div class="space-y-3">
                    <div class="text-slate-700 font-black text-2xl">04</div>
                    <p class="text-[11px] font-black uppercase text-white">API Console</p>
                    <p class="text-[10px] text-slate-500 leading-relaxed">开放端点调用，实现业务系统全自动化对接。</p>
                </div>
            </div>
        </section>

        <!-- Phase 01 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div class="space-y-8">
                <div class="flex items-center gap-4">
                    <div class="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16.24 7.76-1.41 1.41"/><path d="m12 16.5V21"/><path d="m12 7V3"/><path d="M16.24 16.24 19.07 19.07"/><path d="M9.17 9.17 6.34 6.34"/><path d="m7.76 16.24-1.41 1.41"/><circle cx="12" cy="12" r="3"/></svg></div>
                    <h2 class="text-3xl font-black uppercase tracking-tight">Phase 01: Data Search</h2>
                </div>
                <div class="space-y-6 pl-16">
                    <p class="text-slate-400 text-sm leading-relaxed">数据检索模块是整个平台的“透镜”。用户需通过行政区划、Sketch 绘图或 GeoJSON 锁定感兴趣区域 (ROI)，随后通过云量和覆盖率过滤器从 GEE 海量库存中提取像幅。</p>
                </div>
            </div>
            <div class="glass p-4 rounded-[40px] overflow-hidden"><img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800" class="rounded-[32px] opacity-60 w-full" /></div>
        </div>

        <!-- Phase 02 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div class="glass p-4 rounded-[40px] overflow-hidden order-last lg:order-first"><img src="https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=800" class="rounded-[32px] opacity-60 w-full" /></div>
            <div class="space-y-8">
                <div class="flex items-center gap-4">
                    <div class="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10h10V2z"/><path d="M22 12H12v10h10V2z"/><path d="M12 12H2v10h10V12z"/><path d="M22 2H12v10h10V2z"/></svg></div>
                    <h2 class="text-3xl font-black uppercase tracking-tight">Phase 02: Task Management</h2>
                </div>
                <div class="space-y-6 pl-16">
                    <div class="p-6 bg-primary/10 border border-primary/20 rounded-3xl">
                        <p class="text-xs font-black text-primary uppercase flex items-center gap-2 mb-2"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> 处理准则</p>
                        <p class="text-[11px] text-slate-300 leading-relaxed font-bold">系统自动执行云端合成。完成后，处理结果将直接导出至本地物理缓存空间，建立稳定的数据链路供后续 AI 引擎调用。</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Phase 03 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div class="space-y-8">
                <div class="flex items-center gap-4">
                    <div class="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5V3L10 4l2 1Zm0 14v2l2-1-2-1Z"/><path d="M5 12H3l1 2 1-2Zm14 0h2l-1-2-1 2Z"/><path d="M16.5 16.5 18 18l-1-2-0.5 0.5Zm-9-9L6 6l1 2 0.5-0.5Z"/><path d="M16.5 7.5 18 6l-1 2-0.5-0.5Zm-9 9L6 18l1-2 0.5 0.5Z"/><circle cx="12" cy="12" r="4"/></svg></div>
                    <h2 class="text-3xl font-black uppercase tracking-tight">Phase 03: AI Process</h2>
                </div>
                <div class="space-y-6 pl-16">
                    <p class="text-slate-400 text-sm leading-relaxed">这是平台的大脑。通过可视化工作流节点，对 Phase 02 生成的影像序列进行自动化统计分析与深度研判。由 <span class="text-white font-bold">MCFLY AgriBrain</span> 引擎驱动。</p>
                </div>
            </div>
            <div class="glass p-4 rounded-[40px] overflow-hidden"><img src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800" class="rounded-[32px] opacity-60 w-full" /></div>
        </div>

        <!-- Phase 04 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div class="glass p-4 rounded-[40px] overflow-hidden order-last lg:order-first"><img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc48?auto=format&fit=crop&q=80&w=800" class="rounded-[32px] opacity-60 w-full" /></div>
            <div class="space-y-8">
                <div class="flex items-center gap-4">
                    <div class="size-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg></div>
                    <h2 class="text-3xl font-black uppercase tracking-tight">Phase 04: API Console</h2>
                </div>
                <div class="space-y-6 pl-16">
                    <p class="text-slate-400 text-sm leading-relaxed">面向开发者的开放门户。提供低延迟 RESTful 接口与 Python/JS SDK。支持大规模并发检索、云端导出调度及 AI 分析结果的回调集成。</p>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="pt-20 pb-10 border-t border-white/5 flex flex-col items-center gap-8 text-center">
            <div class="space-y-2">
                <p class="text-[10px] font-black uppercase text-white tracking-[0.5em]">SATELLITES GET Mission Systems</p>
                <p class="text-[10px] text-slate-500 font-mono uppercase">Managed by MCFLY AgriBrain Infrastructure Team</p>
            </div>
        </footer>
    </div>
</body>
</html>
    `;

    const blob = new Blob([guideHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SATELLITES_GET_Official_Manual_SNAPSHOT.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl p-4 md:p-8 flex items-center justify-center animate-in fade-in duration-500">
      <div className="w-full max-w-6xl h-full bg-[#0a0c10] border border-white/10 rounded-[40px] flex flex-col overflow-hidden shadow-3xl animate-in zoom-in-95 duration-500">
        
        {/* Header Section - 移除了右上角 X 按钮，固化品牌名称 */}
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-5">
            <div className="p-3 bg-primary/20 rounded-2xl text-primary shadow-lg shadow-primary/10">
              <BookOpen size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                SATELLITES <span className="text-primary">GET</span> <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-500 font-mono align-middle tracking-widest">v1.5.0-SNAPSHOT</span>
              </h3>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1">Platform Operational Blueprint & Technical Manual</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleDownloadManual} 
              className="flex items-center gap-3 px-8 py-3.5 bg-primary/10 border border-primary/20 text-primary rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-black transition-all shadow-lg active:scale-95"
            >
              <Download size={18} /> Download HTML Manual
            </button>
          </div>
        </div>
        
        {/* Content Section - 移除所有关于 LOCAL 强制选择的突出提醒，改为默认流程描述 */}
        <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar space-y-24">
           
           {/* Workflow Flowchart */}
           <section className="bg-white/[0.01] border border-white/5 rounded-[40px] p-10 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="max-w-xs space-y-4">
                 <h4 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3"><Activity size={18} className="text-primary" /> Execution Pipeline</h4>
                 <p className="text-[11px] text-slate-500 leading-relaxed font-bold uppercase tracking-widest">平台采用线性自动化流程。影像检索后由处理核合成，并直接通过 AI 引擎进行深度分析与研判。</p>
              </div>
              <div className="flex-1 flex flex-col md:flex-row items-center gap-4">
                 {[
                   { label: 'Data Search', icon: <Compass size={16} /> },
                   { label: 'Task Management', icon: <Layers size={16} /> },
                   { label: 'AI Process', icon: <BrainCircuit size={16} /> },
                   { label: 'API Console', icon: <Terminal size={16} /> }
                 ].map((step, i) => (
                    <React.Fragment key={step.label}>
                       <div className="flex flex-col items-center gap-3 group">
                          <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:border-primary/50 group-hover:text-primary transition-all shadow-xl">
                             {step.icon}
                          </div>
                          <span className="text-[9px] font-black uppercase text-slate-600 tracking-tighter">{step.label}</span>
                       </div>
                       {i < 3 && <ArrowRight size={20} className="text-slate-800 hidden md:block" />}
                    </React.Fragment>
                 ))}
              </div>
           </section>

           {/* Detailed Phase Sections */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><Compass size={20} /></div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">Phase 01: Data Retrieval</h4>
                 </div>
                 <p className="text-sm text-slate-400 leading-relaxed pl-14">
                    在 Data Search 视图中定义 ROI。设置日期、云量百分比及像幅覆盖率。系统将实时从 GEE 调取 Sentinel-2 资源。
                 </p>
              </div>
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><Layers size={20} /></div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">Phase 02: Processing Kernel</h4>
                 </div>
                 <div className="pl-14 space-y-4">
                    <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl">
                       <p className="text-[10px] font-black text-primary uppercase mb-2 flex items-center gap-2"><AlertCircle size={12} /> 处理准则</p>
                       <p className="text-xs text-slate-300 leading-relaxed font-bold">注入算法核对原始波段进行合成。处理结果将直接导出至本地缓存，建立稳定数据链路，供 AI 引擎进行后续深度推演。</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><BrainCircuit size={20} /></div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">Phase 03: AI Process</h4>
                 </div>
                 <p className="text-sm text-slate-400 leading-relaxed pl-14">
                    构建可视化推断工作流。**MCFLY AgriBrain** 会解析已生成的影像序列，通过多维数据耦合生成双语专家报告，报告支持 PDF/HTML 导出及云端存档。
                 </p>
              </div>
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary"><Terminal size={20} /></div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">Phase 04: Open API Access</h4>
                 </div>
                 <p className="text-sm text-slate-400 leading-relaxed pl-14">
                    通过 API 控制台获取接口协议。平台提供 Public Endpoints，允许业务系统直接集成自动化检索、处理及分析能力。
                 </p>
              </div>
           </div>

           {/* Tech Stack Info */}
           <section className="pt-10 border-t border-white/5 flex flex-wrap justify-center gap-10 opacity-30">
              <div className="flex items-center gap-2"><Database size={16} /> <span className="text-[9px] font-black uppercase tracking-widest">Google Earth Engine</span></div>
              <div className="flex items-center gap-2"><Cpu size={16} /> <span className="text-[9px] font-black uppercase tracking-widest">Sentinel-2 MSI Core</span></div>
              <div className="flex items-center gap-2"><Sparkles size={16} /> <span className="text-[9px] font-black uppercase tracking-widest">MCFLY AgriBrain</span></div>
              <div className="flex items-center gap-2"><Target size={16} /> <span className="text-[9px] font-black uppercase tracking-widest">REST/GeoJSON v1.0</span></div>
           </section>

           <div className="flex flex-col items-center gap-4">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.6em]">System Architecture Authorized Snapshot</p>
              <div className="flex items-center gap-3">
                 <a href="mailto:gonghuaze999@gmail.com" className="flex items-center gap-2 text-primary font-black text-[11px] uppercase underline tracking-widest"><Mail size={14} /> gonghuaze999@gmail.com</a>
              </div>
           </div>
        </div>

        {/* Footer with Dismiss Button */}
        <div className="p-10 bg-black/40 border-t border-white/5 flex justify-center shadow-2xl">
           <button 
              onClick={onClose} 
              className="bg-primary text-black px-16 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
           >
              Dismiss Manual
           </button>
        </div>
      </div>
    </div>
  );
};

export default UserGuide;