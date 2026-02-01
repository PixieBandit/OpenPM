
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TaskBoard from './components/TaskBoard';
import AIAgent from './components/AIAgent';
import ProjectDocs from './components/ProjectDocs';
import Console from './components/Console';
import Auth from './components/Auth';
import BugTracker from './components/BugTracker';
import DebugPanel from './components/DebugPanel';
import NeuralAPIExplorer from './components/NeuralAPIExplorer';
import { Task, TaskStatus, TaskPriority, AgentState, ProjectDoc, WorkflowConfig, LogEntry, AetherAPI, ChatMessage, Project } from './types';
import { INITIAL_TASKS, INITIAL_DOCS } from './constants';
import { analyzeTasks, predictRisks, generateFullReport, generateFeatureContext, identifyBugs, runFeatureTest, refineImplementation, cancelAllRequests } from './services/gemini';
import { acousticEngine } from './services/audio';

const App: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [docs, setDocs] = useState<ProjectDoc[]>(INITIAL_DOCS.map(d => ({ ...d, isRead: true })));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [missionSummary, setMissionSummary] = useState('');
  const [risks, setRisks] = useState<any[]>([]);
  const [fullReport, setFullReport] = useState('');

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      parts: [{ text: "NOVA: Multi-Agent Mesh online. Quartz (QA Sentinel) is patrolling the engineering sub-systems." }],
      timestamp: Date.now()
    }
  ]);

  const [pmState, setPmState] = useState<AgentState>('IDLE');
  const [coderState, setCoderState] = useState<AgentState>('IDLE');
  const [testerState, setTesterState] = useState<AgentState>('IDLE');

  const prevPmState = useRef<AgentState>('IDLE');
  const prevCoderState = useRef<AgentState>('IDLE');
  const prevTesterState = useRef<AgentState>('IDLE');

  const [config, setConfig] = useState<WorkflowConfig>({
    clarificationLevel: 'MODERATE',
    autoTaskGeneration: true,
    autoResolveMinorBugs: true,
    memoryDepth: 5,
    personality: 'SCIENTIFIC',
    novaPower: 80,
    sparkPower: 60,
    testerPower: 70,
    novaRules: '1. Prioritize cooling overhead safety.\n2. Always include risk assessment for new directives.',
    sparkRules: '1. Use modular architecture.\n2. Prioritize energy efficiency.',
    testerRules: '1. Thoroughly stress test all cooling sub-routines.\n2. Flag any gravimetric jitter over 0.05G.\n3. Report bugs directly to Spark.',
    novaModel: 'gemini-2.0-flash',
    sparkModel: 'gemini-2.0-flash',
    testerModel: 'gemini-2.0-flash',
    commProtocol: 'NEURAL_MESH',
    fallbackProtocol: 'RETRY_WITH_BACKOFF',
    queryDelegationProtocol: 'PM_DISCRETION',
    logicVerification: true,
    maxRetries: 3,
    isPaused: true
  });

  const [showDebug, setShowDebug] = useState(false);

  // Keyboard shortcut: Ctrl+Shift+D to toggle debug panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const triggerAudio = (curr: AgentState, prev: AgentState) => {
      if (curr === prev) return;
      if (curr === 'THINKING' || curr === 'WORKING' || curr === 'READING' || curr === 'SCANNING') acousticEngine.playDataCrunch();
      if (curr === 'SUCCESS') acousticEngine.playSuccess();
      if (curr === 'ERROR') acousticEngine.playError();
    };
    triggerAudio(pmState, prevPmState.current);
    triggerAudio(coderState, prevCoderState.current);
    triggerAudio(testerState, prevTesterState.current);
    prevPmState.current = pmState;
    prevCoderState.current = coderState;
    prevTesterState.current = testerState;
  }, [pmState, coderState, testerState]);

  const addLog = useCallback((source: LogEntry['source'], message: string, type: LogEntry['type'] = 'INFO') => {
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      source,
      message,
      type
    };
    setLogs(prev => [...prev.slice(-49), newLog]);
  }, []);

  // Persistence: Load on Mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/data');
        if (res.ok) {
          const data = await res.json();
          if (data.tasks) setTasks(data.tasks);
          if (data.docs) setDocs(data.docs);
          if (data.logs) setLogs(data.logs);
          if (data.config) setConfig(prev => ({ ...prev, ...data.config }));
          if (data.chats && data.chats.length > 0) setChatMessages(data.chats);
          if (data.projects) {
            setProjects(data.projects);
            // Default to first project if available and none selected
            if (data.projects.length > 0) setCurrentProject(data.projects[0]);
          }
          addLog('SYSTEM', 'Neural State Restored from Core Memory.', 'SUCCESS');
        }
      } catch (err) {
        console.error('Failed to load persistence data', err);
        addLog('SYSTEM', 'Core Memory Corruption: Starting fresh.', 'ERROR');
      }
    };
    loadData();
  }, [addLog]);

  // Persistence: Auto-Save
  useEffect(() => {
    const saveData = async () => {
      try {
        await fetch('http://localhost:3001/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tasks,
            docs,
            logs,
            config,
            chats: chatMessages,
            projects
          })
        });
      } catch (err) {
        console.error('Auto-save failed', err);
      }
    };

    const timeoutId = setTimeout(saveData, 2000); // Debounce 2s
    return () => clearTimeout(timeoutId);
  }, [tasks, docs, logs, config, chatMessages]);

  const getBugAssignee = useCallback(() => {
    const rules = config.sparkRules.toLowerCase();
    if (rules.includes('protocol leaks') || rules.includes('system anomalies')) {
      return 'SPARK_UNIT';
    }
    return 'AUTO_RESOLVER';
  }, [config.sparkRules]);

  const triggerFeatureTest = useCallback(async (newTasks: Task[], relatedDocId?: string) => {
    if (config.isPaused) {
      addLog('SYSTEM', 'Feature test aborted: System is paused.', 'WARN');
      return;
    }
    setTesterState('SCANNING');
    addLog('QUARTZ', `Commencing deep audit on ${newTasks.length} engineering directives...`, 'INFO');
    try {
      const audit = await runFeatureTest(newTasks, docs, config);

      if (relatedDocId) {
        setDocs(prev => prev.map(d => d.id === relatedDocId ? {
          ...d,
          qaFeedback: audit.technicalFeedback || audit.findings,
          auditStatus: audit.auditStatus
        } : d));
      }

      if (audit.auditStatus === 'FAILED' && audit.bugs) {
        acousticEngine.playGlitch();
        const now = new Date().toISOString();
        const primaryTaskId = newTasks.length > 0 ? newTasks[0].id : undefined;
        const assignee = getBugAssignee();

        let minorResolvedCount = 0;
        const bugTasks: Task[] = audit.bugs.map((b: any, i: number) => {
          const severity = b.violationSeverity || 0;
          const isMinor = severity < 2;
          const status = (config.autoResolveMinorBugs && isMinor) ? TaskStatus.DONE : TaskStatus.TODO;
          if (status === TaskStatus.DONE) minorResolvedCount++;

          return {
            id: `bug-q-${Date.now()}-${i}`,
            title: `[QA_FAULT] ${b.title}`,
            description: `${b.description}\n\nROOT_CAUSE: ${b.rootCause}\nFIX: ${b.fixRecommendation}`,
            status,
            priority: b.priority as TaskPriority,
            category: 'BUG',
            assignee: assignee,
            dueDate: new Date().toISOString().split('T')[0],
            reporter: b.reporter || 'QUARTZ',
            module: b.module || 'Unknown',
            loggedAt: now,
            diagnosticVector: b.diagnosticVector,
            potentialSideEffects: b.potentialSideEffects,
            violationSeverity: severity,
            linkedTaskId: primaryTaskId
          };
        });

        setTasks(prev => [...prev, ...bugTasks]);
        addLog('QUARTZ', `Audit Failed: ${audit.bugs.length} critical flaws identified. ${minorResolvedCount} minor issues auto-resolved. Routing to ${assignee}.`, 'ERROR');

        if (relatedDocId && audit.technicalFeedback) {
          setCoderState('WORKING');
          addLog('SPARK', 'Quartz feedback received. Auto-refining registry details...', 'INFO');
          const docToFix = docs.find(d => d.id === relatedDocId);
          if (docToFix) {
            const refinedContent = await refineImplementation(docToFix, audit.technicalFeedback, config);
            if (refinedContent) {
              setDocs(prev => prev.map(d => d.id === relatedDocId ? {
                ...d,
                content: refinedContent,
                lastUpdated: new Date().toISOString().split('T')[0],
                auditStatus: 'PASSED',
                isRead: false
              } : d));
              addLog('SPARK', 'Technical Registry auto-refined.', 'SUCCESS');
            }
          }
          setCoderState('SUCCESS');
          setTimeout(() => setCoderState('IDLE'), 1000);
        }
      } else {
        addLog('QUARTZ', 'Audit Passed: Engineering directives verified.', 'SUCCESS');
      }
      setTesterState('SUCCESS');
      setTimeout(() => setTesterState('IDLE'), 2000);
    } catch (err) {
      addLog('QUARTZ', 'Quality audit failure.', 'ERROR');
      setTesterState('ERROR');
    }
  }, [docs, config, addLog, getBugAssignee]);

  const handleTogglePause = useCallback(() => {
    setConfig(prev => {
      const newPausedState = !prev.isPaused;

      if (newPausedState) {
        // Pausing: Cancel requests and log
        cancelAllRequests();
        addLog('SYSTEM', 'EMERGENCY STOP: All neural processes halted. API requests cancelled.', 'WARN');
        setPmState('IDLE');
        setCoderState('IDLE');
        setTesterState('IDLE');
        acousticEngine.playError();
      } else {
        // Resuming: Log only
        addLog('SYSTEM', 'Neural automation protocols resumed.', 'SUCCESS');
        acousticEngine.playSuccess();
      }

      return { ...prev, isPaused: newPausedState };
    });
  }, [addLog]);

  const syncIntelligence = useCallback(async () => {
    if (tasks.length === 0 || !isAuthorized || config.isPaused) return;
    setPmState('THINKING');
    setCoderState('WORKING');
    setTesterState('SCANNING');
    addLog('SYSTEM', 'Initiating neural sync...', 'INFO');

    try {
      const [summary, predictiveRisks, report, bugs] = await Promise.all([
        analyzeTasks(tasks, config),
        predictRisks(tasks, docs, config),
        generateFullReport(tasks, config),
        identifyBugs(tasks, docs, config)
      ]);
      setMissionSummary(summary || '');
      setRisks(predictiveRisks || []);
      setFullReport(report || '');

      if (bugs && bugs.length > 0) {
        const now = new Date().toISOString();
        const assignee = getBugAssignee();
        let minorResolvedCount = 0;

        const bugTasks: Task[] = bugs.map((b: any, i: number) => {
          const severity = b.violationSeverity || 0;
          const isMinor = severity < 2;
          const status = (config.autoResolveMinorBugs && isMinor) ? TaskStatus.DONE : TaskStatus.TODO;
          if (status === TaskStatus.DONE) minorResolvedCount++;

          return {
            id: `bug-ov-${Date.now()}-${i}`,
            title: b.title,
            description: b.description,
            status,
            priority: b.priority as TaskPriority,
            category: 'BUG',
            assignee: assignee,
            dueDate: new Date().toISOString().split('T')[0],
            reporter: b.reporter || 'NOVA',
            module: b.module || 'System',
            loggedAt: now,
            violationSeverity: severity
          };
        });
        setTasks(prev => [...prev, ...bugTasks]);
        addLog('NOVA', `${bugs.length} hazards identified. ${minorResolvedCount} auto-resolved. Assigned to ${assignee}.`, 'WARN');
      }

      setPmState('SUCCESS');
      setCoderState('SUCCESS');
      setTesterState('SUCCESS');
      setTimeout(() => {
        setPmState('IDLE');
        setCoderState('IDLE');
        setTesterState('IDLE');
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown neural sync error';
      addLog('SYSTEM', `Neural sync failed: ${msg}`, 'ERROR');

      if (msg.includes("Requested entity was not found")) {
        addLog('SYSTEM', 'API Project/Key mismatch. Re-authenticating...', 'WARN');
        setIsAuthorized(false);
      }

      setPmState('ERROR');
      setCoderState('ERROR');
      setTesterState('ERROR');
    }
  }, [tasks, docs, addLog, isAuthorized, getBugAssignee, config.autoResolveMinorBugs]);

  /** Neural API Implementation */
  const api: AetherAPI = useMemo(() => ({
    tasks: {
      list: () => tasks,
      create: (task) => {
        const now = new Date().toISOString();
        const newTask: Task = {
          id: `api-${Date.now()}`,
          title: task.title || 'Untitled Directive',
          description: task.description || 'No description provided.',
          status: task.status || TaskStatus.TODO,
          priority: task.priority || TaskPriority.MEDIUM,
          category: task.category || 'API_GEN',
          assignee: task.assignee || 'SYSTEM',
          dueDate: task.dueDate || now.split('T')[0],
          loggedAt: now
        };
        setTasks(prev => [...prev, newTask]);
        addLog('SYSTEM', `External Directive Created: ${newTask.title}`, 'SUCCESS');
      },
      updateStatus: (id, status) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
        addLog('SYSTEM', `Task ${id} status updated to ${status}`, 'INFO');
      }
    },
    docs: {
      list: () => docs,
      query: (term) => docs.filter(d => d.title.includes(term) || d.content.includes(term)),
      add: (title, content, category) => {
        const newDoc: ProjectDoc = {
          id: `doc-${Date.now()}`,
          title,
          content,
          category,
          author: 'LEAD',
          lastUpdated: new Date().toISOString().split('T')[0],
          isRead: true,
          auditStatus: 'PENDING'
        };
        setDocs(prev => [...prev, newDoc]);
        addLog('SYSTEM', `Registry Entry Added: ${title}`, 'SUCCESS');
      }
    },
    system: {
      sync: syncIntelligence,
      getConfig: () => config,
      setConfig: (updates) => {
        setConfig(prev => ({ ...prev, ...updates }));
        addLog('SYSTEM', `Core Configuration Updated via Neural API`, 'WARN');
      },
      getLogs: () => logs
    },
    projects: {
      list: () => projects,
      add: (p: Project) => {
        setProjects(prev => [...prev, p]);
        setCurrentProject(p);
        addLog('SYSTEM', `Project Context Switched: ${p.name}`, 'SUCCESS');
      },
      switch: (id: string) => {
        const p = projects.find(proj => proj.id === id);
        if (p) setCurrentProject(p);
      }
    }
  }), [tasks, docs, config, logs, syncIntelligence, addLog, projects]);

  /** Expose API to Window */
  useEffect(() => {
    (window as any).aether = api;
    console.log("%cAetherSync Neural API Loaded", "color: #6366f1; font-weight: bold; font-size: 14px;");
    console.log("Access via 'window.aether' or use the '/cmd' terminal.");
  }, [api]);

  useEffect(() => {
    if (isAuthorized) syncIntelligence();
  }, [isAuthorized, syncIntelligence]);

  const handleAuthorized = (clearance: string) => {
    // Only set IsAuthorized on login. Do NOT overwrite user config with defaults.
    setIsAuthorized(true);
    addLog('SYSTEM', `Neural link established. Clearance: ${clearance}.`, 'SUCCESS');
  };

  const handleSelectDoc = (id: string | null) => {
    setSelectedDocId(id);
    if (id) {
      setDocs(prev => prev.map(d => d.id === id ? { ...d, isRead: true } : d));
    }
  };

  const activeBugs = tasks.filter(t => t.category === 'BUG' && t.status !== TaskStatus.DONE);

  if (!isAuthorized) return <Auth onAuthorized={handleAuthorized} />;

  // Debug panel overlay
  if (showDebug) return <DebugPanel />;

  return (
    <div className="flex h-screen bg-slate-950 font-sans selection:bg-indigo-500/30 selection:text-white overflow-hidden">
      <Sidebar
        activeTab={activeTab} setActiveTab={setActiveTab}
        pmState={pmState} coderState={coderState} testerState={testerState}
        config={config} setConfig={setConfig} bugCount={activeBugs.length}
        onTogglePause={handleTogglePause}
      />
      <div className="flex-1 ml-64 flex flex-col h-full">
        <main className="flex-1 p-10 overflow-y-auto">
          <header className="flex justify-between items-end mb-12">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Sector: X-07 // Multi-Agent OS</span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
                {activeTab === 'dashboard' && 'Command Deck'}
                {activeTab === 'tasks' && 'Directive Board'}
                {activeTab === 'bugs' && 'Bug Repository'}
                {activeTab === 'agent' && 'Neural Uplink'}
                {activeTab === 'docs' && 'Registry Viewer'}
                {activeTab === 'api' && 'Neural API Registry'}
              </h2>
            </div>
            <div className="flex gap-4">
              <button onClick={syncIntelligence} className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-800 flex items-center gap-3 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Sync OS
              </button>
            </div>
          </header>
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            {activeTab === 'dashboard' && <Dashboard tasks={tasks} summary={missionSummary} risks={risks} report={fullReport} onRefreshIntelligence={syncIntelligence} isLoadingIntelligence={pmState === 'THINKING'} />}
            {activeTab === 'tasks' && <TaskBoard tasks={tasks} onUpdateStatus={(id, s) => setTasks(prev => prev.map(t => t.id === id ? { ...t, status: s } : t))} onDocumentFeature={async (task) => {
              if (config.isPaused) {
                addLog('SYSTEM', 'Spec generation aborted: System is paused.', 'WARN');
                return;
              }
              setCoderState('WORKING');
              try {
                const ctx = await generateFeatureContext(task, config);
                const newDoc: ProjectDoc = { id: `doc-${Date.now()}`, title: `Spec: ${task.title}`, content: JSON.stringify(ctx, null, 2), lastUpdated: new Date().toISOString().split('T')[0], category: 'SPEC', author: 'SPARK', versions: [], auditStatus: 'PENDING', isRead: false };
                setDocs(prev => [newDoc, ...prev]);
                handleSelectDoc(newDoc.id);
                setActiveTab('docs');
                triggerFeatureTest([{ ...task, description: `Verify technical spec: ${JSON.stringify(ctx)}` } as Task], newDoc.id);
                setCoderState('SUCCESS');
              } catch { setCoderState('ERROR'); }
            }} />}
            {activeTab === 'bugs' && <BugTracker bugs={activeBugs} onResolve={(id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, status: TaskStatus.DONE } : t))} onClearAll={() => setTasks(tasks.filter(t => t.category !== 'BUG'))} onScan={syncIntelligence} isScanning={pmState === 'THINKING'} />}
            {activeTab === 'docs' && <ProjectDocs docs={docs} onAddDoc={(t, c, cat) => setDocs([...docs, { id: `doc-${Date.now()}`, title: t, content: c, lastUpdated: new Date().getFullYear().toString(), category: cat, author: 'LEAD', versions: [], auditStatus: 'PENDING', isRead: true }])} onUpdateDoc={(id, updates) => setDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates, lastUpdated: new Date().toISOString().split('T')[0], isRead: true } : d))} isSyncing={pmState === 'READING'} externalSelectedId={selectedDocId} onSelectDoc={handleSelectDoc} />}
            {activeTab === 'agent' && <AIAgent
              messages={chatMessages}
              setMessages={setChatMessages}
              onSuggestTasks={(suggested) => {
                const now = new Date().toISOString();
                const newT = suggested.map((st, i) => ({ id: `ai-${Date.now()}-${i}`, title: st.title, description: st.description, status: TaskStatus.TODO, priority: st.priority as TaskPriority, category: st.category || 'General', assignee: 'SPARK_UNIT', dueDate: now.split('T')[0], module: st.module || 'System', reporter: 'SPARK', loggedAt: now }));
                setTasks(prev => [...prev, ...newT]);
                triggerFeatureTest(newT);
              }} pmState={pmState} setPmState={setPmState} coderState={coderState} setCoderState={setCoderState} testerState={testerState} docs={docs} config={config} setConfig={setConfig} addLog={addLog} logs={logs}
              projects={projects} setProjects={setProjects} currentProject={currentProject} setCurrentProject={setCurrentProject}
            />}
            {activeTab === 'api' && <NeuralAPIExplorer api={api} />}
          </div>
        </main>
        <Console logs={logs} onClear={() => setLogs([])} api={api} onLog={addLog} />
      </div>
    </div>
  );
};

export default App;
