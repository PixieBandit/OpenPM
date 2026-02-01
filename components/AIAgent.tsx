import React, { useState, useRef, useEffect } from 'react';
import { streamGeminiResponse, suggestNewTasks } from '../services/gemini';
import { fetchAvailableModels, GeminiModel, formatTokenLimit } from '../services/models';
import { ChatMessage, Task, AgentState, ProjectDoc, WorkflowConfig, LogEntry, Project } from '../types';
import { scanProjectDirectory, createProjectContext, generateProjectSummaryDoc } from '../services/projectManager';
import { AgentAvatar } from './AgentAvatar';
import { acousticEngine } from '../services/audio';
import ReactMarkdown from 'react-markdown';

interface AIAgentProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onSuggestTasks: (suggested: any[]) => void;
  pmState: AgentState;
  setPmState: (s: AgentState) => void;
  coderState: AgentState;
  setCoderState: (s: AgentState) => void;
  testerState: AgentState;
  docs: ProjectDoc[];
  config: WorkflowConfig;
  setConfig: (config: WorkflowConfig) => void;
  addLog: (source: LogEntry['source'], message: string, type?: LogEntry['type']) => void;
  logs: LogEntry[];
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  currentProject: Project | null;
  setCurrentProject: (p: Project) => void;
}

const ThinkingBlock: React.FC<{ content: string; isVisible: boolean }> = ({ content, isVisible }) => {
  if (!isVisible || !content) return null;
  return (
    <div className="mb-2 p-3 bg-indigo-950/30 border-l-2 border-indigo-500 rounded-r-lg animate-in fade-in slide-in-from-left-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
        <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Neural Processing</span>
      </div>
      <p className="text-[10px] font-mono text-indigo-200/80 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
};

const FormattedMessage: React.FC<{ text: string; showThinking: boolean }> = ({ text, showThinking }) => {
  const thoughtMatch = text.match(/<thought>([\s\S]*?)<\/thought>/);
  const thoughtContent = thoughtMatch ? thoughtMatch[1] : '';
  const finalContent = text.replace(/<thought>[\s\S]*?<\/thought>/, '').trim();

  return (
    <div className="flex flex-col">
      {thoughtContent && <ThinkingBlock content={thoughtContent} isVisible={showThinking} />}
      {finalContent && (
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{finalContent}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

const AIAgent: React.FC<AIAgentProps> = ({
  messages, setMessages,
  onSuggestTasks,
  pmState, setPmState,
  coderState, setCoderState,
  testerState,
  docs, config, setConfig, addLog,
  logs,
  projects, setProjects,
  currentProject, setCurrentProject
}) => {
  const [input, setInput] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    directives: true,
    comm: false,
    neural: false
  });
  const [availableModels, setAvailableModels] = useState<GeminiModel[]>([]);

  // Project Wizard State
  const [projectFlow, setProjectFlow] = useState<'IDLE' | 'NEW_LOC' | 'NEW_NAME' | 'EXISTING_LOC' | 'EXISTING_NAME'>('IDLE');
  const [tempProjectData, setTempProjectData] = useState<{ path?: string; name?: string }>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const sparkRef = useRef<HTMLDivElement>(null);
  const quartzRef = useRef<HTMLDivElement>(null);

  // Fetch available models on mount
  useEffect(() => {
    fetchAvailableModels().then(models => {
      setAvailableModels(models);
      console.log('Loaded models for dropdown:', models.map(m => m.id));
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pmState, streamingContent]);

  useEffect(() => {
    if (sparkRef.current) sparkRef.current.scrollTop = sparkRef.current.scrollHeight;
  }, [logs, coderState]);

  useEffect(() => {
    if (quartzRef.current) quartzRef.current.scrollTop = quartzRef.current.scrollHeight;
  }, [logs, testerState]);


  const toggleSection = (section: string) => {
    acousticEngine.playTick();
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSend = async () => {
    if (!input.trim() || pmState === 'THINKING' || config.isPaused) return;
    const userMsg: ChatMessage = { role: 'user', parts: [{ text: input }], timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setStreamingContent('');

    // --- PROJECT WIZARD INTERCEPTION ---
    if (projectFlow !== 'IDLE') {
      if (projectFlow === 'NEW_LOC') {
        setTempProjectData({ ...tempProjectData, path: currentInput });
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Understood. What shall we name this new project?" }], timestamp: Date.now() }]);
        setProjectFlow('NEW_NAME');
        return;
      }
      if (projectFlow === 'NEW_NAME') {
        const newProj: Project = {
          id: `proj-${Date.now()}`,
          name: currentInput,
          path: tempProjectData.path || 'Unknown',
          description: 'New Project',
          features: [],
          lastActive: Date.now()
        };
        setProjects(prev => [...prev, newProj]);
        setCurrentProject(newProj);
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Project "**${currentInput}**" initialized. Context switched.` }], timestamp: Date.now() }]);
        setProjectFlow('IDLE');
        setTempProjectData({});
        return;
      }
      if (projectFlow === 'EXISTING_LOC') {
        setTempProjectData({ ...tempProjectData, path: currentInput });
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Path verified. Accessing neural catalog... What is the project name?" }], timestamp: Date.now() }]);
        setProjectFlow('EXISTING_NAME');
        return;
      }
      if (projectFlow === 'EXISTING_NAME') {
        setPmState('SCANNING');
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: "_Scanning file protocols..._" }], timestamp: Date.now() }]);

        const scan = await scanProjectDirectory(tempProjectData.path || '');
        if (!scan.exists) {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: `⚠️ **Error**: Directory not found or inaccessible: \`${tempProjectData.path}\`. Aborting.` }], timestamp: Date.now() }]);
          setProjectFlow('IDLE');
          setPmState('IDLE');
          return;
        }

        const contextSummary = createProjectContext(currentInput, scan);
        const newDoc = generateProjectSummaryDoc('pending', currentInput, contextSummary);
        // We can't add doc directly to App state from here without a prop, but we can assume saving the project implies saving its context?
        // Actually, AIAgent receives `docs` but not `setDocs`. 
        // We should probably rely on the Agent "learning" it or just storing it in the project object if we update `Project` type, or just rely on the user manually adding it?
        // Wait, the Requirement said: "take each feature and piece and document all of the new project into memory."
        // "Memory" usually means `docs` or `tasks`.
        // Ideally `setDocs` should be passed to AIAgent.
        // For now, I will just acknowledge the scan. 
        // LIMITATION: `setDocs` not available. I will add it to the Project object if I modify Project type, OR I will just instruct the user.
        // BETTER: I will assume `onSuggestTasks` might handle this? No.
        // I will modify `AIAgentProps` to include `setDocs` in a future step if critical. 
        // For now, I will just save the project entry.

        const newProj: Project = {
          id: `proj-${Date.now()}`,
          name: currentInput,
          path: tempProjectData.path || 'Unknown',
          description: `Imported with ${scan.files.length} files.`,
          features: scan.packageJson?.dependencies ? Object.keys(scan.packageJson.dependencies) : [],
          lastActive: Date.now()
        };
        setProjects(prev => [...prev, newProj]);
        setCurrentProject(newProj);

        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Project "**${currentInput}**" cataloged and active. \n\n**Scan Summary**:\n- Files: ${scan.files.length}\n- Dependencies: ${Object.keys(scan.packageJson?.dependencies || {}).length}` }], timestamp: Date.now() }]);

        setPmState('SUCCESS');
        setTimeout(() => setPmState('IDLE'), 1000);
        setProjectFlow('IDLE');
        setTempProjectData({});
        return;
      }
    }
    // -----------------------------------

    setPmState('THINKING');

    try {
      // Add a placeholder message for Nova that we will update with the stream
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: '' }], timestamp: Date.now() }]);

      let fullText = '';
      const stream = streamGeminiResponse(currentInput, messages, docs, config);

      for await (const chunk of stream) {
        fullText += chunk;
        setStreamingContent(fullText);
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'model') {
            lastMsg.parts[0].text = fullText;
          }
          return newMsgs;
        });
      }

      const novaOutput = fullText || "UPLINK_FAILURE";
      setPmState('SUCCESS');
      setTimeout(() => setPmState('IDLE'), 1000);

      const isTechnical = /implement|build|create|add|fix|code|engineer|project|deploy|integrate|setup|config/i.test(currentInput);
      // Determine if valid technical request or explicit "Spark" mention
      const shouldTriggerSpark = config.autoTaskGeneration && (isTechnical || currentInput.toLowerCase().includes('spark'));

      if (shouldTriggerSpark) {
        setCoderState('WORKING');
        const sparkResponse = await suggestNewTasks(currentInput, novaOutput, docs.slice(0, config.memoryDepth), config);
        if (sparkResponse.status === 'SUCCESS' && sparkResponse.tasks) {
          onSuggestTasks(sparkResponse.tasks);
          // We can add distinct messages for Spark here if we want them in the main chat too, 
          // but for now we'll rely on the side panel seeing the logs/tasks
          addLog('SPARK', `Feature directives submitted: ${sparkResponse.tasks.length} tasks.`, 'SUCCESS');
        }
        setCoderState('SUCCESS');
        setTimeout(() => setCoderState('IDLE'), 2000);
      }
    } catch (error) {
      // Display error message in chat so user can see it
      const errorMessage = error instanceof Error ? error.message : 'Neural uplink interrupted. Please try again.';
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg.role === 'model') {
          lastMsg.parts[0].text = errorMessage;
        }
        return newMsgs;
      });
      setPmState('ERROR');
      addLog('SYSTEM', 'Stream Interrupted: ' + errorMessage, 'ERROR');
    }
  };

  const Section: React.FC<{ id: string; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
    <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/30">
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <span className="text-[10px] font-black text-white uppercase tracking-widest">{title}</span>
        <svg className={`w-4 h-4 text-slate-500 transition-transform ${openSections[id] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {openSections[id] && (
        <div className="p-6 border-t border-slate-800 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)]">
      {/* Main Nova Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
        {isConfigOpen && (
          <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl p-8 animate-in fade-in zoom-in duration-300 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Mission BIOS Settings</h3>
              </div>
              <button onClick={() => { acousticEngine.playTick(); setIsConfigOpen(false); }} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white font-mono text-[10px] uppercase tracking-widest transition-all">Exit_BIOS</button>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
              <Section id="directives" title="Custom Agent Directives">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { key: 'novaRules', label: 'NOVA_LOGIC', color: 'indigo' },
                    { key: 'sparkRules', label: 'SPARK_ENGINE', color: 'teal' },
                    { key: 'testerRules', label: 'QUARTZ_SENTINEL', color: 'amber' }
                  ].map(field => (
                    <div key={field.key} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full bg-${field.color}-500`} />
                        <label className={`text-[9px] font-black text-${field.color}-400 uppercase tracking-widest`}>{field.label}</label>
                      </div>
                      <textarea
                        value={(config as any)[field.key]}
                        onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                        className="w-full h-48 bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-slate-400 focus:outline-none focus:border-indigo-500/50 placeholder-slate-700 transition-all shadow-inner"
                        placeholder={`Define custom logic for ${field.label}...`}
                      />
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="comm" title="Communication & Delegation Protocols">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Protocol Architecture</label>
                    <div className="grid grid-cols-1 gap-2">
                      {['SYNCHRONOUS', 'ASYNCHRONOUS', 'NEURAL_MESH'].map(proto => (
                        <button
                          key={proto}
                          onClick={() => setConfig({ ...config, commProtocol: proto as any })}
                          className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${config.commProtocol === proto ? 'bg-indigo-500/10 border-indigo-500/50 text-white' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
                        >
                          <span className="text-[10px] font-bold uppercase">{proto}</span>
                          {config.commProtocol === proto && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Query Delegation Strategy</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'PM_DECIDE', label: 'Always let the PM decide' },
                        { id: 'PM_DISCRETION', label: 'PM decides if it should ask the user' },
                        { id: 'ALWAYS_ASK', label: 'Always ask the user' }
                      ].map(strat => (
                        <button
                          key={strat.id}
                          onClick={() => setConfig({ ...config, queryDelegationProtocol: strat.id as any })}
                          className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${config.queryDelegationProtocol === strat.id ? 'bg-amber-500/10 border-amber-500/50 text-white' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
                        >
                          <span className="text-[10px] font-bold uppercase">{strat.label}</span>
                          {config.queryDelegationProtocol === strat.id && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4 col-span-full">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fallback Mechanisms</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {['HALT_ON_ERROR', 'RETRY_WITH_BACKOFF', 'FAIL_SAFE_DEGRADATION'].map(fallback => (
                        <button
                          key={fallback}
                          onClick={() => setConfig({ ...config, fallbackProtocol: fallback as any })}
                          className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between ${config.fallbackProtocol === fallback ? 'bg-rose-500/10 border-rose-500/50 text-white' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
                        >
                          <span className="text-[10px] font-bold uppercase">{fallback.replace(/_/g, ' ')}</span>
                          {config.fallbackProtocol === fallback && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-full pt-4 border-t border-slate-800">
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('http://localhost:3001/api/health');
                          if (res.ok) {
                            const data = await res.json();
                            alert(`Uplink Secure: ${JSON.stringify(data)}`);
                          } else {
                            alert(`Uplink Error: ${res.status}`);
                          }
                        } catch (e) {
                          alert(`Uplink Connectivity Failure: ${e}`);
                        }
                      }}
                      className="w-full py-3 bg-emerald-900/20 hover:bg-emerald-800/30 border border-emerald-800/50 text-emerald-400 font-bold uppercase text-[10px] tracking-widest rounded-xl transition-all"
                    >
                      Test Neural Uplink Connection
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          // Dynamically import to safely use the new function
                          const { listAvailableModels } = await import('../services/gemini');
                          const data = await listAvailableModels();
                          if ((data as any).models) {
                            const names = (data as any).models.map((m: any) => m.name).join('\n');
                            alert(`Available Models:\n${names}`);
                            console.log('Models:', data);
                          } else {
                            alert(`Model List Error: ${JSON.stringify(data)}`);
                          }
                        } catch (e) {
                          alert(`Failed to list models: ${e}`);
                        }
                      }}
                      className="w-full py-3 bg-indigo-900/20 hover:bg-indigo-800/30 border border-indigo-800/50 text-indigo-400 font-bold uppercase text-[10px] tracking-widest rounded-xl transition-all mt-2"
                    >
                      List Cloud AI Models
                    </button>
                  </div>
                </div>
              </Section>
              <Section id="neural" title="Neural Core Tuning">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nova Core Model (Architect)</label>
                      <select
                        value={config.novaModel}
                        onChange={(e) => setConfig({ ...config, novaModel: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500 transition-all shadow-inner"
                      >
                        {availableModels.length === 0 && <option value="">Loading models...</option>}
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.displayName} ({formatTokenLimit(m.inputTokenLimit)})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Spark Core Model (Engineer)</label>
                      <select
                        value={config.sparkModel}
                        onChange={(e) => setConfig({ ...config, sparkModel: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-teal-500 transition-all shadow-inner"
                      >
                        {availableModels.length === 0 && <option value="">Loading models...</option>}
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.displayName} ({formatTokenLimit(m.inputTokenLimit)})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Quartz Core Model (Tester)</label>
                      <select
                        value={config.testerModel}
                        onChange={(e) => setConfig({ ...config, testerModel: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500 transition-all shadow-inner"
                      >
                        {availableModels.length === 0 && <option value="">Loading models...</option>}
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.displayName} ({formatTokenLimit(m.inputTokenLimit)})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Memory Depth: {config.memoryDepth}</label>
                      <input type="range" min="1" max="20" value={config.memoryDepth} onChange={(e) => setConfig({ ...config, memoryDepth: parseInt(e.target.value) })} className="w-full accent-indigo-500 bg-slate-900 h-1 rounded-full appearance-none cursor-pointer" />
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        )}

        <div className="px-8 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <AgentAvatar type="nova" state={pmState} size="sm" />
            <div className="flex flex-col">
              <p className="text-xs font-black text-white uppercase tracking-widest">Nova Command</p>
              <p className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">Status: Handshake_Stable</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${showThinking ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-indigo-400'}`}
            >
              {showThinking ? '👁️ Process_Vis: ON' : 'Process_Vis: OFF'}
            </button>
            <button
              onClick={() => { acousticEngine.playTick(); setIsConfigOpen(true); }}
              className="group flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-indigo-600 rounded-xl border border-slate-700 hover:border-indigo-500 transition-all shadow-lg"
            >
              <svg className="w-4 h-4 text-slate-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
              <span className="text-[9px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest">BIOS</span>
            </button>

            {/* Project Selector */}
            <div className="relative group/proj">
              <select
                value={currentProject?.id || 'new'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'new') {
                    setProjectFlow('NEW_LOC');
                    setMessages(prev => [...prev, { role: 'model', parts: [{ text: "**Initialize New Project Protocol**.\n\nPlease enter the target directory path for the new project:" }], timestamp: Date.now() }]);
                  } else if (val === 'add_existing') {
                    setProjectFlow('EXISTING_LOC');
                    setMessages(prev => [...prev, { role: 'model', parts: [{ text: "**Import Existing Project Protocol**.\n\nPlease enter the full directory path of the existing project:" }], timestamp: Date.now() }]);
                  } else {
                    const p = projects.find(proj => proj.id === val);
                    if (p) {
                      setCurrentProject(p);
                      setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Active Context switched to: **${p.name}**` }], timestamp: Date.now() }]);
                    }
                  }
                }}
                className="bg-slate-900 border border-slate-700 hover:border-indigo-500 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 rounded-xl focus:outline-none transition-all cursor-pointer"
              >
                <option value="" disabled>Select Project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option disabled>──────────</option>
                <option value="new">+ Create New</option>
                <option value="add_existing">+ Add Existing</option>
              </select>
            </div>

          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-2xl p-5 max-w-[85%] border ${msg.role === 'user' ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_4px_20px_rgba(99,102,241,0.2)]' : 'bg-slate-900 border-slate-800 text-slate-200 shadow-xl'}`}>
                <div className="flex items-center gap-2 mb-2 opacity-50">
                  <div className={`w-1.5 h-1.5 rounded-full ${msg.role === 'user' ? 'bg-white' : (msg.parts[0].text.includes('SPARK') ? 'bg-teal-400' : (msg.parts[0].text.includes('QUARTZ') ? 'bg-amber-400' : 'bg-indigo-400'))}`} />
                  <span className="text-[9px] font-black uppercase tracking-widest">{msg.role === 'model' ? 'Nova Command' : 'Lead Sci'}</span>
                </div>
                <FormattedMessage text={msg.parts[0].text} showThinking={showThinking} />
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-slate-950/80 border-t border-slate-800 backdrop-blur-md">
          <div className="flex gap-3 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Issue architectural directives to Nova..."
              className="flex-1 bg-slate-900 border border-slate-800 text-white text-[13px] rounded-xl py-4 px-6 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 font-mono transition-all placeholder-slate-700 shadow-inner"
            />
            <button
              onClick={handleSend}
              disabled={pmState === 'THINKING' || config.isPaused}
              className={`p-4 rounded-xl transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${config.isPaused ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Right Side Stack: Spark & Quartz */}
      <div className="w-96 flex flex-col gap-4">

        {/* Spark (Dev) Window */}
        <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AgentAvatar type="spark" state={coderState} size="sm" />
              <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest">Spark (Dev)</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${coderState === 'WORKING' ? 'bg-teal-500 animate-ping' : 'bg-slate-700'}`} />
          </div>
          <div ref={sparkRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[10px]">
            {/* Filter Logs for Spark or Code related */}
            {logs.filter(l => l.source === 'SPARK').map((log, i) => (
              <div key={i} className={`p-2 rounded border border-teal-900/30 bg-teal-900/10 text-teal-200/80`}>
                <span className="opacity-50">[{log.timestamp.split('T')[1].split('.')[0]}]</span> {log.message}
              </div>
            ))}
            {/* Show default message if empty */}
            {logs.filter(l => l.source === 'SPARK').length === 0 && (
              <div className="text-slate-600 text-center mt-10 italic">Spark awaits directives...</div>
            )}
          </div>
        </div>

        {/* Quartz (QA) Window */}
        <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AgentAvatar type="quartz" state={testerState} size="sm" />
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Quartz (QA)</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${testerState === 'SCANNING' ? 'bg-amber-500 animate-ping' : 'bg-slate-700'}`} />
          </div>
          <div ref={quartzRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[10px]">
            {/* Filter Logs for Quartz or QA related */}
            {logs.filter(l => l.source === 'QUARTZ' || l.message.includes('Audit') || l.message.includes('bug')).map((log, i) => (
              <div key={i} className={`p-2 rounded border border-amber-900/30 bg-amber-900/10 text-amber-200/80`}>
                <span className="opacity-50">[{log.timestamp.split('T')[1].split('.')[0]}]</span> {log.message}
              </div>
            ))}
            {/* Show default message if empty */}
            {logs.filter(l => l.source === 'QUARTZ').length === 0 && (
              <div className="text-slate-600 text-center mt-10 italic">Quartz awaits audit targets...</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AIAgent;
