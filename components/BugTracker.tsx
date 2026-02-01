
import React, { useMemo } from 'react';
import { Task, TaskStatus, TaskPriority } from '../types';
import { acousticEngine } from '../services/audio';

interface BugTrackerProps {
  bugs: Task[];
  onResolve: (bugId: string) => void;
  onClearAll: () => void;
  onScan: () => void;
  isScanning: boolean;
}

const BugTracker: React.FC<BugTrackerProps> = ({ bugs, onResolve, onClearAll, onScan, isScanning }) => {
  const integrity = useMemo(() => {
    if (bugs.length === 0) return 100;
    const penalty = bugs.reduce((acc, bug) => {
      if (bug.priority === TaskPriority.CRITICAL) return acc + 25;
      if (bug.priority === TaskPriority.HIGH) return acc + 15;
      return acc + 5;
    }, 0);
    return Math.max(0, 100 - penalty);
  }, [bugs]);

  const getPriorityData = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.CRITICAL: 
        return { 
          color: 'text-rose-500', 
          bg: 'bg-rose-500/10', 
          border: 'border-rose-500/50',
          glow: 'shadow-[0_0_25px_rgba(244,63,94,0.3)]',
          label: 'CRITICAL_HAZARD', 
          icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' 
        };
      case TaskPriority.HIGH:
        return { 
          color: 'text-orange-500', 
          bg: 'bg-orange-500/10', 
          border: 'border-orange-500/40',
          glow: 'shadow-[0_0_15px_rgba(249,115,22,0.2)]',
          label: 'HIGH_PRIORITY_FAULT', 
          icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' 
        };
      default: 
        return { 
          color: 'text-amber-500', 
          bg: 'bg-amber-500/10', 
          border: 'border-slate-800',
          glow: '',
          label: 'PROTOCOL_LEAK', 
          icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' 
        };
    }
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'LOG_DATA_MISSING';
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      return ts;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <style>{`
        @keyframes pulse-icon {
          0%, 100% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 2px rgba(244, 63, 94, 0.4)); }
          50% { transform: scale(1.3); opacity: 0.7; filter: drop-shadow(0 0 12px rgba(244, 63, 94, 0.8)); }
        }
        @keyframes alert-badge-pulse {
          0%, 100% { background-color: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.2); }
          50% { background-color: rgba(244, 63, 94, 0.25); border-color: rgba(244, 63, 94, 0.5); }
        }
        @keyframes border-glow-critical {
          0%, 100% { 
            border-color: rgba(244, 63, 94, 0.4); 
            box-shadow: 0 0 15px rgba(244, 63, 94, 0.1), inset 0 0 5px rgba(244, 63, 94, 0.05); 
          }
          50% { 
            border-color: rgba(244, 63, 94, 1); 
            box-shadow: 0 0 35px rgba(244, 63, 94, 0.4), inset 0 0 12px rgba(244, 63, 94, 0.1); 
          }
        }
      `}</style>

      {/* Integrity HUD */}
      <div className={`bg-slate-900/60 border ${integrity < 50 ? 'border-rose-500/40 animate-pulse' : 'border-slate-800'} rounded-3xl p-8 backdrop-blur-md relative overflow-hidden group transition-all duration-1000`}>
        <div className="absolute top-0 right-0 p-10 opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
          <svg className="w-48 h-48" viewBox="0 0 100 100" fill="white">
            <path d="M50 10 L90 90 L10 90 Z" />
          </svg>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className="relative">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-800" />
                <circle 
                  cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="6" fill="transparent" 
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * integrity) / 100}
                  className={`transition-all duration-1000 ease-out ${integrity < 70 ? 'text-rose-500' : 'text-emerald-500'}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-lg font-black font-mono leading-none ${integrity < 70 ? 'text-rose-500' : 'text-white'}`}>{integrity}%</span>
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mt-1">Integrity</span>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Diagnostic Core Status</h2>
              <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-widest">
                Sector_X07: {integrity === 100 ? '[SYSTEM_OPTIMAL]' : '[ANOMALIES_DETECTED]'}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => { acousticEngine.playTick(); onScan(); }}
              disabled={isScanning}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-3 ${
                isScanning 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' 
                  : 'bg-slate-950 border-slate-800 hover:border-indigo-500 text-slate-400 hover:text-white'
              }`}
            >
              <svg className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isScanning ? 'Deep_Neural_Scan...' : 'Run_Diagnostics'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bugs.map((bug) => {
          const ui = getPriorityData(bug.priority);
          const isCritical = bug.priority === TaskPriority.CRITICAL;
          
          return (
            <div 
              key={bug.id} 
              className={`group bg-slate-900/40 border-2 ${ui.border} rounded-3xl p-6 relative overflow-hidden transition-all hover:bg-slate-900 shadow-xl ${ui.glow} ${isCritical ? 'animate-[border-glow-critical_2.5s_infinite]' : ''}`}
            >
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800/50">
                <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border border-transparent transition-all ${ui.bg} ${isCritical ? 'animate-[alert-badge-pulse_2s_infinite]' : ''}`}>
                  <svg className={`w-3.5 h-3.5 ${ui.color} ${isCritical ? 'animate-[pulse-icon_1s_infinite]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={ui.icon} />
                  </svg>
                  <span className={`text-[8px] font-black uppercase tracking-widest ${ui.color}`}>
                    {ui.label}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-mono text-slate-500">ID: {bug.id.split('-').slice(-1)}</span>
                  <span className="text-[7px] font-mono text-slate-700">{formatTimestamp(bug.loggedAt)}</span>
                </div>
              </div>

              <h3 className={`text-sm font-bold ${isCritical ? 'text-rose-400' : 'text-slate-100'} mb-3 uppercase tracking-tight leading-tight group-hover:text-indigo-400 transition-colors flex items-center gap-2`}>
                {bug.title}
                {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />}
              </h3>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="flex flex-col p-2 rounded-xl border border-slate-800 bg-slate-950/40">
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Vector</span>
                  <span className="text-[9px] font-mono text-indigo-400 truncate">{bug.diagnosticVector || 'LOGIC_DRIFT'}</span>
                </div>
                <div className="flex flex-col p-2 rounded-xl border border-slate-800 bg-slate-950/40">
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Module</span>
                  <span className="text-[9px] font-mono text-teal-400 truncate">{bug.module || 'UNKNOWN'}</span>
                </div>
              </div>

              {bug.linkedTaskId && (
                <div className="mb-4 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-1">Source Directive</span>
                  <p className="text-[9px] font-mono text-indigo-500">TASK_REF: #{bug.linkedTaskId.split('-').slice(-1)}</p>
                </div>
              )}
              
              <div className="text-[11px] text-slate-400 leading-relaxed mb-6 font-mono">
                {bug.description.split('\n\n').map((part, idx) => (
                  <p key={idx} className={idx > 0 ? 'mt-3 border-t border-slate-800/30 pt-3 text-[9px] text-slate-500' : ''}>
                    {part}
                  </p>
                ))}
                {bug.potentialSideEffects && (
                  <div className="mt-4 p-2 bg-rose-500/5 rounded-lg border border-rose-500/10">
                    <span className="text-[7px] font-black text-rose-500/60 uppercase block mb-1">Side_Effects</span>
                    <p className="text-[9px] text-rose-300/80 leading-tight italic">{bug.potentialSideEffects}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                <div className="flex flex-col">
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em]">Reporter</span>
                  <span className="text-[9px] font-mono text-indigo-500">{bug.reporter || 'QUARTZ'}</span>
                </div>
                <button 
                  onClick={() => {
                    acousticEngine.playTick();
                    onResolve(bug.id);
                  }}
                  className={`bg-slate-950 border border-slate-800 hover:border-emerald-500 hover:bg-emerald-600/10 hover:text-emerald-400 text-slate-400 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg`}
                >
                  Resolve_Fault
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BugTracker;
