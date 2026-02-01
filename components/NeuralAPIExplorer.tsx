
import React from 'react';
import { AetherAPI, TaskPriority } from '../types';

interface NeuralAPIExplorerProps {
  api: AetherAPI;
}

const NeuralAPIExplorer: React.FC<NeuralAPIExplorerProps> = ({ api }) => {
  const apiEndpoints = [
    {
      group: 'Directives (Tasks)',
      endpoints: [
        { name: 'aether.tasks.list()', desc: 'Returns all current mission directives.', returns: 'Task[]' },
        { name: 'aether.tasks.create(task)', desc: 'Injects a new directive into the Board.', params: 'Partial<Task>' },
        { name: 'aether.tasks.updateStatus(id, status)', desc: 'Transitions a node between operation states.', params: 'string, TaskStatus' }
      ]
    },
    {
      group: 'Registry (Memory)',
      endpoints: [
        { name: 'aether.docs.list()', desc: 'Retrieves all archived technical documentation.', returns: 'ProjectDoc[]' },
        { name: 'aether.docs.query(term)', desc: 'Performs a string match across the neural memory.', params: 'string', returns: 'ProjectDoc[]' },
        { name: 'aether.docs.add(t, c, cat)', desc: 'Archives new technical data into the registry.', params: 'string, string, Category' }
      ]
    },
    {
      group: 'BIOS (System)',
      endpoints: [
        { name: 'aether.system.sync()', desc: 'Triggers a full neural recalculation.', returns: 'Promise<void>' },
        { name: 'aether.system.getConfig()', desc: 'Returns current agent power and rules.', returns: 'WorkflowConfig' },
        { name: 'aether.system.setConfig(updates)', desc: 'Live-patches the agent logic matrix.', params: 'Partial<WorkflowConfig>' }
      ]
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full pb-20 overflow-y-auto custom-scrollbar">
      <div className="space-y-8">
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" strokeWidth={1} /></svg>
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-4">API Overview</h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            The AetherSync Neural API provides programmatic hooks into the multi-agent mesh. 
            Automate directives, query deep memory, or reconfigure BIOS settings from external nodes.
          </p>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 font-mono">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">Handshake_Auth_Token</span>
              <span className="text-[10px] text-emerald-500 font-bold">VERIFIED</span>
            </div>
            <div className="text-[11px] text-indigo-400 break-all bg-indigo-500/5 p-3 rounded-lg border border-indigo-500/10">
              aether_node_auth_9182x_nu_07_mesh_stable
            </div>
          </div>
        </div>

        {apiEndpoints.map((group, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">{group.group}</h3>
            <div className="space-y-3">
              {group.endpoints.map((ep, eIdx) => (
                <div key={eIdx} className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-5 hover:border-indigo-500/30 transition-all group">
                  <div className="flex items-start justify-between mb-2">
                    <code className="text-[12px] font-black text-indigo-400 font-mono tracking-tight">{ep.name}</code>
                    {ep.returns && (
                       <span className="text-[9px] font-mono text-slate-600 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">{ep.returns}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mb-0">{ep.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 h-fit shadow-2xl relative">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Neural Terminal Explorer</h3>
            <div className="flex gap-2">
               <div className="w-2 h-2 rounded-full bg-rose-500" />
               <div className="w-2 h-2 rounded-full bg-amber-500" />
               <div className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Usage Example: Dynamic Directive Injection</p>
              <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 font-mono text-[12px] text-slate-300 relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => {
                    // TaskPriority import added to fix "Cannot find name 'TaskPriority'"
                    api.tasks.create({ title: 'Synthetic Node Fix', priority: TaskPriority.CRITICAL, description: 'Created via API Explorer example.' });
                  }} className="text-[9px] bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-black uppercase tracking-widest active:scale-95">Run_Direct</button>
                </div>
                <div className="text-indigo-500/50 mb-1">// Sector_X-07 Automation Script</div>
                <div><span className="text-indigo-400">aether.tasks.create</span>({'{'}</div>
                <div className="pl-6">title: <span className="text-emerald-400">"Synthetic Node Fix"</span>,</div>
                <div className="pl-6">priority: <span className="text-amber-400">"CRITICAL"</span>,</div>
                <div className="pl-6">description: <span className="text-slate-500">"Neural sync correction."</span></div>
                <div>{'}'});</div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Usage Example: Power Matrix Configuration</p>
              <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 font-mono text-[12px] text-slate-300 relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => {
                    api.system.setConfig({ novaPower: 95, personality: 'SCIENTIFIC' });
                  }} className="text-[9px] bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-black uppercase tracking-widest active:scale-95">Apply_BIOS</button>
                </div>
                <div className="text-indigo-500/50 mb-1">// BIOS Neural Re-Handshake</div>
                <div><span className="text-indigo-400">aether.system.setConfig</span>({'{'}</div>
                <div className="pl-6">novaPower: <span className="text-indigo-400">95</span>,</div>
                <div className="pl-6">personality: <span className="text-emerald-400">"SCIENTIFIC"</span></div>
                <div>{'}'});</div>
              </div>
            </div>
            
            <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
               <p className="text-[11px] text-indigo-400/80 leading-relaxed italic">
                 "Direct API access bypasses standard safety interlocks. Use the Console /cmd interface for manual verification before large-scale registry modifications."
                 <br /><br />
                 <span className="font-black">— NOVA, Lead Architect</span>
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NeuralAPIExplorer;
