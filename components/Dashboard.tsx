
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Task, TaskStatus } from '../types';

interface Risk {
  risk: string;
  severity: string;
  mitigation: string;
}

interface IntelligenceItem extends Risk {
  id: string;
  timestamp: string;
  isRead: boolean;
  fullDetails?: string;
}

interface DashboardProps {
  tasks: Task[];
  summary: string;
  risks: Risk[];
  report: string;
  onRefreshIntelligence: () => void;
  isLoadingIntelligence: boolean;
}

const IntelligenceCard: React.FC<{ item: IntelligenceItem; onRead: (id: string) => void }> = ({ item, onRead }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      onClick={() => {
        setIsExpanded(!isExpanded);
        if (!item.isRead) onRead(item.id);
      }}
      className={`relative group bg-slate-950/50 border border-slate-800/50 p-4 rounded-2xl transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] ${isExpanded ? 'bg-slate-900/80 border-indigo-500/30' : ''}`}
    >
      {!item.isRead && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse" />
      )}
      
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${
          item.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
        }`}>
          {item.severity}
        </span>
        <span className="text-[7px] font-mono text-slate-600 uppercase tracking-widest">{item.timestamp}</span>
      </div>

      <h4 className="text-xs font-bold text-slate-200 mb-2 leading-snug group-hover:text-white transition-colors">
        {item.risk}
      </h4>
      
      <p className={`text-[10px] text-slate-500 italic leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>
        {item.mitigation}
        {isExpanded && (
          <span className="block mt-4 pt-4 border-t border-slate-800/50 text-slate-400 font-normal not-italic">
            {item.risk}. This risk was identified during the latest neural workspace audit. Implementation of the suggested mitigation strategy is recommended to maintain gravimetric stability across Sector X-07.
          </span>
        )}
      </p>

      {!isExpanded && (
        <div className="mt-3 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-3 h-3 text-slate-600 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
  tasks, summary, risks, onRefreshIntelligence, isLoadingIntelligence 
}) => {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === TaskStatus.DONE).length;
    const critical = tasks.filter(t => t.priority === 'CRITICAL' || t.category === 'BUG').length;
    return { total, completed, critical, progress: Math.round((completed / (total || 1)) * 100) };
  }, [tasks]);

  const intelligenceItems = useMemo(() => {
    if (!risks || risks.length === 0) return [];
    return risks.map((r, i) => ({
      ...r,
      id: `risk-${i}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: readIds.has(`risk-${i}`)
    }));
  }, [risks, readIds]);

  const telemetryData = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      name: i,
      load: 40 + Math.sin(i / 2) * 20 + Math.random() * 10,
      stability: 100 - (stats.critical * 8) - (Math.random() * 5)
    }));
  }, [stats]);

  return (
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Directives', value: stats.total, color: 'text-white' },
          { label: 'Flux Stability', value: `${Math.max(0, 100 - (stats.critical * 12))}%`, color: stats.critical > 2 ? 'text-rose-400' : 'text-emerald-400' },
          { label: 'Inertial Dampening', value: 'NOMINAL', color: 'text-indigo-400' },
          { label: 'Neural Sync', value: '99.8%', color: 'text-teal-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className={`text-2xl font-black font-mono ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-2/3 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-32 h-32" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" /></svg>
          </div>
          
          <div className="flex items-center justify-between mb-8">
             <div>
               <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                 Gravimetric Stability Monitor
                 <span className="flex gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                 </span>
               </h3>
               <p className="text-[10px] text-slate-500 font-mono">SENSOR_ARRAY: SECTOR_X-07</p>
             </div>
             <button onClick={onRefreshIntelligence} className={`text-right group ${isLoadingIntelligence ? 'animate-pulse' : ''}`}>
                <span className="text-[10px] font-mono text-emerald-500 tracking-tighter group-hover:underline">REFRESH_INTEL</span>
                <p className="text-[9px] text-slate-600 font-mono uppercase">Source: Deep_Neural_Handshake</p>
             </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryData}>
                <defs>
                  <linearGradient id="colorStability" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="stability" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorStability)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:w-1/3 flex flex-col gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 flex-1 shadow-2xl overflow-y-auto max-h-[480px]">
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-slate-900/80 backdrop-blur-md py-2 z-10">
              <h3 className="text-[11px] font-black text-white uppercase tracking-widest">Project Intelligence</h3>
              <span className="text-[9px] font-mono text-indigo-400">FEED_ACTIVE</span>
            </div>
            
            <div className="space-y-4">
              {intelligenceItems.map((item) => (
                <IntelligenceCard 
                  key={item.id} 
                  item={item} 
                  onRead={(id) => setReadIds(prev => new Set(prev).add(id))} 
                />
              ))}
              {intelligenceItems.length === 0 && !isLoadingIntelligence && (
                <p className="text-center text-[10px] font-mono text-slate-600 py-20 uppercase tracking-widest">
                  Awaiting_Sync_Data...
                </p>
              )}
              {isLoadingIntelligence && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                   <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                   <p className="text-[10px] font-mono text-indigo-500 animate-pulse uppercase">Crunching_Neural_Matrix...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
