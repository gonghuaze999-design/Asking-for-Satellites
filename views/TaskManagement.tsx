
import React from 'react';
import { Filter, RefreshCw, Database, CloudUpload, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from '../types';

interface TaskManagementProps {
  tasks: Task[];
}

const TaskManagement: React.FC<TaskManagementProps> = ({ tasks }) => {
  const activeCount = tasks.filter(t => t.status === 'RUNNING').length;
  const completedCount = tasks.filter(t => t.status === 'COMPLETED').length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background-dark p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Active Pipelines</h2>
          <p className="text-slate-400 text-sm mt-1">Real-time telemetry for GEE export operations</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-panel-dark border border-border-dark rounded-lg text-sm font-medium hover:border-slate-500 transition-all">
            <Filter size={16} /> Filter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Processing', value: activeCount, color: 'text-primary' },
          { label: 'Completed', value: completedCount, color: 'text-emerald-500' },
          { label: 'Queue Capacity', value: '84%', color: 'text-slate-300' },
          { label: 'Data Egress', value: '1.2 GB/s', color: 'text-primary' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-panel-dark border border-border-dark p-6 rounded-xl">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">{stat.label}</p>
            <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar border border-border-dark rounded-xl bg-panel-dark">
        <table className="w-full text-left border-collapse">
          <thead className="bg-background-dark/50 border-b border-border-dark sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Pipeline ID</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Process Name</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Progress</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Time Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-dark">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic text-sm">No active tasks found in the last 24 hours.</td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="hover:bg-background-dark/30 transition-colors">
                  <td className="px-6 py-5 text-[10px] font-mono text-slate-500">{task.id}</td>
                  <td className="px-6 py-5">
                    <p className="text-sm font-bold">{task.name}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 uppercase">
                      <CloudUpload size={10} /> {task.type}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      task.status === 'RUNNING' ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-500'
                    }`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="w-32 h-1.5 bg-background-dark rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-700" style={{ width: `${task.progress}%` }} />
                    </div>
                  </td>
                  <td className="px-6 py-5 text-xs text-slate-400 font-mono">{task.estRemaining || 'Done'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskManagement;
