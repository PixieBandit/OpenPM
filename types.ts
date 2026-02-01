
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  assignee: string;
  dueDate: string;
  reporter?: string;
  module?: string;
  loggedAt?: string;
  diagnosticVector?: string;
  potentialSideEffects?: string;
  violationSeverity?: number;
  linkedTaskId?: string;
}

export interface DocVersion {
  id: string;
  timestamp: string;
  content: string;
  author: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  features: string[];
  lastActive: number;
}

export interface ProjectDoc {
  id: string;
  title: string;
  content: string;
  lastUpdated: string;
  category: 'ARCH' | 'SPEC' | 'RESEARCH' | 'LOG';
  author: 'NOVA' | 'SPARK' | 'LEAD' | 'QUARTZ';
  versions?: DocVersion[];
  qaFeedback?: string;
  auditStatus?: 'PASSED' | 'FAILED' | 'PENDING';
  isRead?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp: number;
}

export type AgentState = 'IDLE' | 'THINKING' | 'WORKING' | 'SUCCESS' | 'ERROR' | 'READING' | 'SCANNING';

export type QueryDelegation = 'PM_DECIDE' | 'PM_DISCRETION' | 'ALWAYS_ASK';

export interface WorkflowConfig {
  clarificationLevel: 'STRICT' | 'MODERATE' | 'NONE';
  autoTaskGeneration: boolean;
  autoResolveMinorBugs: boolean;
  memoryDepth: number;
  personality: 'PROFESSIONAL' | 'SCIENTIFIC' | 'CONCISE';
  novaPower: number;
  sparkPower: number;
  testerPower: number;
  novaRules: string;
  sparkRules: string;
  testerRules: string;
  novaModel: string;
  sparkModel: string;
  testerModel: string;
  commProtocol: 'SYNCHRONOUS' | 'ASYNCHRONOUS' | 'NEURAL_MESH';
  fallbackProtocol: 'HALT_ON_ERROR' | 'RETRY_WITH_BACKOFF' | 'FAIL_SAFE_DEGRADATION';
  queryDelegationProtocol: QueryDelegation;
  logicVerification: boolean;
  maxRetries: number;
  isPaused: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: 'SYSTEM' | 'NOVA' | 'SPARK' | 'QUARTZ' | 'USER';
  message: string;
  type: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'COMMAND';
}

/** 
 * Neural API interface for external or terminal-based access 
 */
export interface AetherAPI {
  tasks: {
    list: () => Task[];
    create: (task: Partial<Task>) => void;
    updateStatus: (id: string, status: TaskStatus) => void;
  };
  docs: {
    list: () => ProjectDoc[];
    query: (term: string) => ProjectDoc[];
    add: (title: string, content: string, category: ProjectDoc['category']) => void;
  };
  system: {
    sync: () => Promise<void>;
    getConfig: () => WorkflowConfig;
    setConfig: (updates: Partial<WorkflowConfig>) => void;
    getLogs: () => LogEntry[];
  };
  projects: {
    list: () => Project[];
    add: (project: Project) => void;
    switch: (id: string) => void;
  };
}
