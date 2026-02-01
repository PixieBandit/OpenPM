
import React, { useState, useEffect } from 'react';
import { ICONS } from '../constants';
import { AgentAvatar } from './AgentAvatar';
import { AgentState, WorkflowConfig, ProjectDoc } from '../types';
import { acousticEngine } from '../services/audio';
import { fetchAvailableModels, GeminiModel, formatTokenLimit } from '../services/models';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pmState: AgentState;
  coderState: AgentState;
  testerState: AgentState;
  config: WorkflowConfig;
  setConfig: (config: WorkflowConfig) => void;
  bugCount: number;
  onTogglePause: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, pmState, coderState, testerState, config, setConfig, bugCount, onTogglePause }) => {
  const [availableModels, setAvailableModels] = useState<GeminiModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  // Fetch available models on mount
  useEffect(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const models = await fetchAvailableModels();
        setAvailableModels(models);
      } catch (error) {
        console.error('Failed to load models:', error);
      } finally {
        setIsLoadingModels(false);
      }
    };
    loadModels();
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Command Deck', icon: ICONS.Dashboard },
    { id: 'tasks', label: 'Directive Board', icon: ICONS.Tasks },
    {
      id: 'bugs', label: 'Bug Tracker', icon: (props: any) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
          <path d="M12 2L12 7M12 17L12 22M2 12L7 12M17 12L22 12M5 5L8.5 8.5M15.5 15.5L19 19M5 19L8.5 15.5M15.5 8.5L19 5" strokeLinecap="round" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ), badge: bugCount > 0 ? bugCount : null
    },
    { id: 'docs', label: 'Neural Memory', icon: ICONS.Knowledge },
    { id: 'agent', label: 'Uplink Channel', icon: ICONS.Agent },
    {
      id: 'api', label: 'Neural API', icon: (props: any) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
          <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
  ];

  const docCategories: ProjectDoc['category'][] = ['ARCH', 'SPEC', 'RESEARCH', 'LOG'];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-900 flex flex-col h-screen fixed left-0 top-0 z-20">
      <div className="p-6 flex flex-col h-full overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 mb-10 shrink-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg border border-white/10">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L4 10V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V10L12 2Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tighter text-white uppercase">Aether OS</h1>
            <p className="text-[10px] text-indigo-400 font-mono font-bold leading-none uppercase">Mesh_Live</p>
          </div>
          <button
            onClick={onTogglePause}
            className={`ml-auto p-2 rounded-lg transition-all ${config.isPaused
              ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20 animate-pulse'
              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300'
              }`}
            title={config.isPaused ? "Resume Automation" : "Emergency Stop / Pause"}
          >
            {config.isPaused ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M8 5V19L19 12L8 5Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            )}
          </button>
        </div>

        <nav className="space-y-1 mb-8 shrink-0">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                acousticEngine.playTick();
                setActiveTab(item.id);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${activeTab === item.id ? 'bg-indigo-500/10 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                }`}
            >
              <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-indigo-400' : 'group-hover:text-white'}`} />
              <span className="font-bold text-xs uppercase tracking-wider">{item.label}</span>
              {item.badge && <span className="ml-auto bg-rose-600 text-[9px] font-black text-white px-1.5 py-0.5 rounded-full animate-pulse">{item.badge}</span>}
            </button>
          ))}
        </nav>

        {activeTab === 'docs' && (
          <div className="mb-8 space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">Registry Sub-Sectors</h3>
            <div className="grid grid-cols-1 gap-1">
              {docCategories.map(cat => (
                <button
                  key={cat}
                  className="flex items-center justify-between px-4 py-2 rounded-lg text-[9px] font-bold text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/5 transition-all uppercase tracking-widest border border-transparent hover:border-indigo-500/10"
                >
                  <span className="flex items-center gap-2">
                    <div className={`w-1 h-1 rounded-full ${cat === 'ARCH' ? 'bg-purple-500' :
                      cat === 'SPEC' ? 'bg-teal-500' :
                        cat === 'RESEARCH' ? 'bg-amber-500' : 'bg-indigo-500'
                      }`} />
                    {cat}_FILES
                  </span>
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 5l7 7-7 7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8 space-y-4 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">Neural Matrix</h3>
            {isLoadingModels && (
              <span className="text-[8px] text-indigo-400 animate-pulse">Loading models...</span>
            )}
          </div>
          <div className="space-y-4">
            {[{ label: 'NOVA', val: config.novaPower, key: 'novaPower', modelKey: 'novaModel', color: 'indigo' },
            { label: 'SPARK', val: config.sparkPower, key: 'sparkPower', modelKey: 'sparkModel', color: 'teal' },
            { label: 'QUARTZ', val: config.testerPower, key: 'testerPower', modelKey: 'testerModel', color: 'amber' }
            ].map(agent => (
              <div key={agent.label} className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className={`text-[9px] font-bold text-${agent.color}-400`}>{agent.label}_PWR</span>
                  <span className="text-[8px] font-mono text-slate-600">{agent.val}%</span>
                </div>
                <input
                  type="range" min="0" max="100" value={agent.val}
                  onChange={(e) => setConfig({ ...config, [agent.key as any]: parseInt(e.target.value) })}
                  className={`w-full accent-${agent.color}-500 bg-slate-900 h-1 rounded-full appearance-none cursor-pointer`}
                />
                <select
                  value={(config as any)[agent.modelKey] || 'gemini-2.0-flash'}
                  onChange={(e) => setConfig({ ...config, [agent.modelKey]: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 text-[9px] text-slate-400 px-2 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {isLoadingModels ? (
                    <option>Loading models...</option>
                  ) : availableModels.length > 0 ? (
                    availableModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.displayName} ({formatTokenLimit(model.inputTokenLimit)})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </>
                  )}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-900 space-y-2 shrink-0">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/30">
            <AgentAvatar type="nova" state={pmState} size="sm" />
            <div className="flex-1 min-w-0"><p className="text-[9px] font-black text-white truncate uppercase tracking-tighter">NOVA (PM)</p></div>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/30">
            <AgentAvatar type="spark" state={coderState} size="sm" />
            <div className="flex-1 min-w-0"><p className="text-[9px] font-black text-white truncate uppercase tracking-tighter">SPARK (DEV)</p></div>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/30">
            <AgentAvatar type="quartz" state={testerState} size="sm" />
            <div className="flex-1 min-w-0"><p className="text-[9px] font-black text-white truncate uppercase tracking-tighter">QUARTZ (QA)</p></div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

