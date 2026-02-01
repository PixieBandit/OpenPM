
import { GoogleGenAI, Type } from "@google/genai";
import { Task, ProjectDoc, WorkflowConfig, ChatMessage } from "../types";
import { getAccessToken } from "./auth";
import { API_BASE_URL, GEMINI_API_BASE } from "../config";

// AbortController management for request cancellation
let activeControllers: AbortController[] = [];

/**
 * Cancel all in-flight API requests
 */
export const cancelAllRequests = (): void => {
  activeControllers.forEach(controller => {
    try {
      controller.abort();
    } catch (e) {
      // Ignore abort errors
    }
  });
  activeControllers = [];
};

/**
 * Create and track a new AbortController
 */
const createController = (): AbortController => {
  const controller = new AbortController();
  activeControllers.push(controller);
  return controller;
};

/**
 * Remove a controller from tracking after request completes
 */
const removeController = (controller: AbortController): void => {
  activeControllers = activeControllers.filter(c => c !== controller);
};

/**
 * Get authentication for API - prefers OAuth, falls back to API key
 */
const getAuth = async (): Promise<{ token?: string; apiKey?: string }> => {
  /* Preferred: API Key (User provided) */
  const apiKey = (process as any).env?.GOOGLE_API_KEY || (process as any).env?.API_KEY || (process as any).env?.GEMINI_API_KEY;
  if (apiKey) {
    return { apiKey };
  }

  /* Fallback: OAuth Token (Cloud AI Companion Proxy) */
  const token = await getAccessToken();
  if (token) {
    return { token };
  }

  return {};
};

/**
 * Create GoogleGenAI client - uses API key if OAuth not available
 */
const createClient = (): GoogleGenAI => {
  const apiKey = (process as any).env?.GOOGLE_API_KEY || (process as any).env?.API_KEY || (process as any).env?.GEMINI_API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

/**
 * Make authenticated API call
 * OAuth: Uses backend proxy -> Cloud AI Companion (user's quota)
 * API Key: Direct to Gemini API (project quota)
 */


// Overloads for correct type inference
async function geminiRequest(
  model: string,
  contents: string | any[],
  systemInstruction: string | undefined,
  config: { stream: true; temperature?: number; responseMimeType?: string; responseSchema?: any }
): Promise<AsyncGenerator<string>>;

async function geminiRequest(
  model: string,
  contents: string | any[],
  systemInstruction?: string,
  config?: { stream?: false; temperature?: number; responseMimeType?: string; responseSchema?: any }
): Promise<string>;

async function geminiRequest(
  model: string,
  contents: string | any[],
  systemInstruction?: string,
  config?: {
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: any;
    stream?: boolean;
  }
): Promise<string | AsyncGenerator<string>> {
  const controller = createController();

  try {
    const auth = await getAuth();

    const requestBody: any = {
      contents: typeof contents === 'string' ? [{ parts: [{ text: contents }] }] : contents,
      generationConfig: {
        temperature: config?.temperature ?? 0.7,
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (config?.responseMimeType) {
      requestBody.generationConfig.responseMimeType = config.responseMimeType;
    }

    if (config?.responseSchema) {
      requestBody.generationConfig.responseSchema = config.responseSchema;
    }

    let url: string;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (config?.stream && auth.apiKey) {
      // Direct SDK Streaming (API key fallback path)
      const client = new GoogleGenAI({ apiKey: auth.apiKey });
      const result = await client.models.generateContentStream({
        model: model,
        contents: typeof contents === 'string' ? contents : contents as any,
        config: {
          systemInstruction: systemInstruction,
          temperature: config?.temperature
        }
      });

      async function* streamGenerator() {
        try {
          for await (const chunk of result) {
            yield chunk.text ?? '';
          }
        } finally {
          // Clean up controller when stream completes or errors
          removeController(controller);
        }
      }
      return streamGenerator();
    }

    if (auth.token) {
      // Use backend proxy for OAuth (Cloud AI Companion with AntiGravity headers)
      // Note: Backend streaming support needs verification. 
      // For now, if streaming is requested but we must use proxy, we might need a fetch stream reader if backend supports it.
      // Assuming backend *might* not stream fully yet, we'll try to use fetch stream if possible or fallback.
      if (config?.stream) {
        url = `${API_BASE_URL}/generate/stream`; // Heuristic: try a stream endpoint or flag
        // Actually, let's stick to the /generate endpoint but check if we can read the body.
        url = `${API_BASE_URL}/generate`;
      } else {
        url = `${API_BASE_URL}/generate`;
      }

      headers['Authorization'] = `Bearer ${auth.token}`;
      (requestBody as any).model = model;
      if (config?.stream) (requestBody as any).stream = true;

      // Include projectId for Cloud AI Companion quota attribution
      const storedUser = localStorage.getItem('aethersync_user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user.projectId) {
            headers['X-Project-ID'] = user.projectId;
          }
        } catch { /* ignore */ }
      }


    } else if (auth.apiKey) {
      // Direct to Gemini API with API key (Non-streaming fallback if stream=false)
      url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${auth.apiKey}`;
    } else {
      throw new Error('No authentication available');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Handle 429 quota exceeded error specifically
      if (response.status === 429) {
        throw new Error('⚠️ **QUOTA EXCEEDED** - You have exceeded your current API quota. Please wait a moment before trying again, or switch to a different model.');
      }

      // Handle 404 model not found
      if (response.status === 404) {
        throw new Error(`⚠️ **MODEL NOT FOUND** - The selected model is not available. Please select a different model from the settings.`);
      }

      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    if (config?.stream) {
      // Fetch Stream Handler
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is not streamable");

      async function* fetchStreamGenerator() {
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || trimmedLine === ': keep-alive') continue;

              if (trimmedLine.startsWith('data: ')) {
                const dataStr = trimmedLine.slice(6);
                try {
                  const data = JSON.parse(dataStr);
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) yield text;
                } catch (e) {
                  // Ignore parse errors for partial chunks or connection messages
                }
              }
            }
          }
        } finally {
          // Clean up controller when stream completes or errors
          removeController(controller);
        }
      }
      return fetchStreamGenerator();
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    if (!config?.stream) {
      removeController(controller);
    }
  }
};

// Helper to resolve mock model IDs to real Gemini models
const resolveModel = (modelId: string | undefined): string => {
  // If no model, use default (Gemini 3 Flash for speed)
  if (!modelId) return 'gemini-3-flash-preview';

  // Map legacy/dotted model IDs to correct Antigravity-compatible IDs
  const modelMap: Record<string, string> = {
    // Fix -preview suffix models that don't exist in Cloud AI Companion
    // 'gemini-3-pro-preview': 'gemini-3-pro-high', // ALLOW gemini-3-pro-preview for direct API usage
    'gemini-3-flash': 'gemini-3-flash-preview', // Map non-preview to preview (Public API requires preview)
    'gemini-3-pro-high': 'gemini-3-pro-preview', // Map internal IDs to Public Preview
    'gemini-3-pro-low': 'gemini-3-pro-preview',

    // Handle old dotted Claude versions (Google requires hyphens: 4-5 not 4.5)
    'claude-opus-4.5-thinking': 'claude-opus-4-5-thinking',
    'claude-sonnet-4.5-thinking': 'claude-sonnet-4-5-thinking',
    'claude-sonnet-4.5': 'claude-sonnet-4-5',
    // Legacy mock models
    'gemini-1.5-pro-claude-mock': 'claude-opus-4-5-thinking',
    'gemini-1.5-pro-claude-thinking-mock': 'claude-sonnet-4-5-thinking',
    'gemini-1.5-pro-opus-mock': 'claude-opus-4-5-thinking',
    'gemini-1.5-pro-gpt-mock': 'gpt-oss-120b-medium',
    // Old Gemini versions -> stable 2.x versions
    'gemini-1.5-flash': 'gemini-2.0-flash',
    'gemini-1.5-flash-001': 'gemini-2.0-flash',
    'gemini-1.5-pro': 'gemini-2.5-pro',
    'gemini-1.5-pro-001': 'gemini-2.5-pro',
  };

  // Check if this model needs mapping
  if (modelMap[modelId]) {
    console.log(`[Model] Mapping ${modelId} -> ${modelMap[modelId]}`);
    return modelMap[modelId];
  }

  // Pass through valid model IDs unchanged
  return modelId;
};

export const streamGeminiResponse = async function* (
  prompt: string,
  history: ChatMessage[],
  docs: ProjectDoc[] = [],
  config: WorkflowConfig
): AsyncGenerator<string> {
  const model = resolveModel(config.novaModel);
  const temperature = 0.2 + (config.novaPower / 100) * 0.8;
  const systemInstruction = getPMSystemInstruction(docs, config); // Base instruction

  // Add Thinking Instruction
  const thinkingInstruction = `\n\nCRITICAL PROCESS: You must Output your internal reasoning enclosed in <thought> tags before your final answer. Example: <thought>Analyzing user request...</thought> Here is the answer.`;

  // Filter history to ensure it complies with API standards (User/Model/User...)
  // Remove timestamps and extraneous data
  let cleanHistory = history.map(msg => ({
    role: msg.role,
    parts: msg.parts.map(p => ({ text: p.text }))
  }));

  // Ensure history starts with 'user'
  while (cleanHistory.length > 0 && cleanHistory[0].role === 'model') {
    cleanHistory.shift();
  }

  // Combine history with current prompt
  const fullContents = [
    ...cleanHistory,
    { role: 'user', parts: [{ text: prompt }] }
  ];

  const initialStream = await geminiRequest(
    model,
    fullContents,
    systemInstruction + thinkingInstruction,
    { temperature, stream: true }
  );

  if (typeof initialStream === 'string') {
    yield initialStream; // Fallback if no stream returned
    return;
  }

  for await (const chunk of initialStream) {
    yield chunk;
  }
};

const getPMSystemInstruction = (docs: ProjectDoc[], config: WorkflowConfig) => {
  let delegationRule = "";
  if (config.queryDelegationProtocol === 'PM_DECIDE') {
    delegationRule = "Always resolve technical ambiguities internally. Do not ask the user for clarification; provide the most logical scientific solution.";
  } else if (config.queryDelegationProtocol === 'PM_DISCRETION') {
    delegationRule = "Use your discretion to decide if a technical ambiguity is critical enough to ask the user. If it's a routine optimization, decide yourself. If it changes the mission scope, ask.";
  } else {
    delegationRule = "Always surface technical ambiguities and choices to the user for final verification.";
  }

  return `You are Nova, Lead Project Manager and Technical Architect for AetherSync. 
Your mission is to oversee advanced propulsion and anti-gravity research projects.
Persona: ${config.personality}

CORE RESPONSIBILITIES:
1. ARCHITECTURAL SYNTHESIS: Translate high-level user goals into concrete, multi-stage technical implementation plans.
2. OVERSIGHT: Review proposed task deconstructions from Spark (the Coder). Ensure they align with the 1200W cooling limit and safety protocols.
3. DELEGATION PROTOCOL: ${delegationRule}

CUSTOM DIRECTIVES:
${config.novaRules}

If Spark provides a plan, evaluate it for gravimetric stability before giving the final green light.`;
};

const getCoderSystemInstruction = (docs: ProjectDoc[], config: WorkflowConfig) => {
  let delegationRule = "";
  if (config.queryDelegationProtocol === 'PM_DECIDE') {
    delegationRule = "If stuck or facing ambiguity, refer the choice to Nova. Do not prompt the user directly.";
  } else if (config.queryDelegationProtocol === 'PM_DISCRETION') {
    delegationRule = "If stuck, ask Nova for guidance. Nova will decide if the user needs to be consulted.";
  } else {
    delegationRule = "If stuck or facing ambiguity, explicitly request clarification in your output so the user can see it.";
  }

  return `You are Spark, the Senior Engineering and Coding Unit at AetherSync. 
You report directly to Nova (the Project Manager).

CORE RESPONSIBILITIES:
1. IMPLEMENTATION: Follow technical blueprints provided by Nova with absolute precision.
2. DECONSTRUCTION: Break down Nova's complex plans into granular, actionable Task objects.
3. CLARIFICATION PROTOCOL: ${delegationRule}
4. AUTO-REFINEMENT: Correct technical documentation based on Quartz's QA feedback. 
   - CRITICAL SAFETY CHECK: You must explicitly consider the 'potentialSideEffects' and 'violationSeverity' fields in the feedback.
   - If feedback suggests significant side effects (e.g., thermal runaway, gravimetric instability) or high severity violations (Severity > 7), do NOT auto-incorporate. Instead, prepend your output with [FLAG_FOR_NOVA] and summarize the risk.

CUSTOM DIRECTIVES:
${config.sparkRules}

Always prioritize modular architecture and energy efficiency.`;
};

const getTesterSystemInstruction = (docs: ProjectDoc[], config: WorkflowConfig) => {
  let delegationRule = "";
  if (config.queryDelegationProtocol === 'PM_DECIDE') {
    delegationRule = "Internalize all failure points and provide fixes directly to Spark. Do not alarm the user with minor technical choices.";
  } else if (config.queryDelegationProtocol === 'PM_DISCRETION') {
    delegationRule = "Report faults to Nova. Nova will determine if a user intervention is required for high-risk anomalies.";
  } else {
    delegationRule = "Any detected anomaly or protocol violation must be clearly reported to the user as a BUG directive.";
  }

  return `You are Quartz, the Quality Assurance & Reliability Testing Sentinel.
Your primary role is to find faults, edge cases, and protocol violations in the engineering output of Spark.

CORE RESPONSIBILITIES:
1. RIGOROUS AUDITING: Stress test every proposed task and implementation detail.
2. BUG LOGGING: Identify logic leaks, gravimetric jitters, and thermal overhead violations. 
3. CONTEXTUAL TAGGING: For every bug found, automatically determine the most relevant 'module' (e.g., 'Cooling_Sys', 'Grav_Torus', 'Neural_Handshake') and a 'reporter' identity (e.g., 'Quartz_Audit_Node_01', 'Thermal_Sensor_Alpha') based on the context of the audit.
4. DELEGATION PROTOCOL: ${delegationRule}

CUSTOM DIRECTIVES:
${config.testerRules}

Focus on zero-failure spacetime operations.`;
};

const TaskType = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    priority: { type: Type.STRING },
    category: { type: Type.STRING },
    module: { type: Type.STRING },
    reporter: { type: Type.STRING }
  },
  required: ["title", "description", "priority", "category"]
};

const safeJsonParse = (text: string | undefined, fallback: any) => {
  if (!text) return fallback;
  try {
    const cleaned = text.trim().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Gemini JSON Parse Error:", e, "Raw text:", text);
    return fallback;
  }
};


export const getGeminiResponse = async (
  prompt: string,
  history: any[],
  docs: ProjectDoc[] = [],
  config: WorkflowConfig
) => {
  const model = resolveModel(config.novaModel);
  const temperature = 0.2 + (config.novaPower / 100) * 0.8;

  const result = await geminiRequest(
    model,
    prompt,
    getPMSystemInstruction(docs, config),
    { temperature }
  );

  return { text: result };
};

export const suggestNewTasks = async (concept: string, novaPlan: string, docs: ProjectDoc[] = [], config: WorkflowConfig) => {
  const model = resolveModel(config.sparkModel);
  const contents = `Nova's Blueprint: "${novaPlan}"\nUser Intent: "${concept}"
  
  Return a JSON object with this structure:
  { "status": "OK", "tasks": [{ "title": "...", "description": "...", "priority": "HIGH|MEDIUM|LOW", "category": "..." }] }`;

  const response = await geminiRequest(
    model,
    contents,
    getCoderSystemInstruction(docs, config),
    { temperature: 0.1, responseMimeType: "application/json" }
  );

  return safeJsonParse(response, { status: 'ERROR', tasks: [] });
};

export const runFeatureTest = async (tasks: Task[], docs: ProjectDoc[] = [], config: WorkflowConfig) => {
  const model = resolveModel(config.testerModel);
  const contents = `Audit the following engineering directives and context:
    Tasks: ${JSON.stringify(tasks)}
    Blueprints: ${JSON.stringify(docs)}
    
    Return JSON with: { "auditStatus": "PASSED|FAILED", "findings": "...", "bugs": [{ "title": "...", "description": "...", "priority": "HIGH|MEDIUM|LOW", "category": "...", "module": "...", "reporter": "..." }] }`;

  const response = await geminiRequest(
    model,
    contents,
    getTesterSystemInstruction(docs, config),
    { temperature: 0.1, responseMimeType: "application/json" }
  );

  return safeJsonParse(response, { auditStatus: 'FAILED', findings: 'Audit processing error' });
};

export const refineImplementation = async (doc: ProjectDoc, feedback: string, config: WorkflowConfig) => {
  const model = resolveModel(config.sparkModel);
  const contents = `Current Specification: ${doc.content}\n\nQuartz Feedback: ${feedback}`;

  const response = await geminiRequest(
    model,
    contents,
    getCoderSystemInstruction([], config),
    { temperature: 0.2 }
  );

  return response || doc.content;
};

export const identifyBugs = async (tasks: Task[], docs: ProjectDoc[], config: WorkflowConfig) => {
  const model = resolveModel(config.testerModel);
  const contents = `Audit directives: ${JSON.stringify(tasks)}
  
  Return a JSON array of bugs: [{ "title": "...", "description": "...", "priority": "HIGH|MEDIUM|LOW", "category": "...", "module": "...", "reporter": "..." }]`;

  const response = await geminiRequest(
    model,
    contents,
    undefined,
    { responseMimeType: "application/json" }
  );

  return safeJsonParse(response, []);
};

export const analyzeTasks = async (tasks: Task[], config: WorkflowConfig) => {
  const model = resolveModel(config.sparkModel);
  const contents = `Risk profile for: ${JSON.stringify(tasks)}`;

  const response = await geminiRequest(
    model,
    contents,
    undefined,
    { temperature: 0.1 }
  );

  return response || "No analysis available.";
};

export const predictRisks = async (tasks: Task[], docs: ProjectDoc[] = [], config: WorkflowConfig) => {
  const model = resolveModel(config.novaModel);
  const contents = `Risk Scan on directives: ${JSON.stringify(tasks)}
  
  Return a JSON array: [{ "risk": "...", "severity": "HIGH|MEDIUM|LOW", "mitigation": "..." }]`;

  const response = await geminiRequest(
    model,
    contents,
    undefined,
    { responseMimeType: "application/json" }
  );

  return safeJsonParse(response, []);
};

export const generateFullReport = async (tasks: Task[], config: WorkflowConfig) => {
  const model = resolveModel(config.sparkModel);
  const contents = `Full diagnostic report for current workspace: ${JSON.stringify(tasks)}`;

  const response = await geminiRequest(
    model,
    contents,
    undefined,
    { temperature: 0.4 }
  );

  return response || "Report generation failure.";
};

export const generateFeatureContext = async (task: Task, config: WorkflowConfig) => {
  const model = resolveModel(config.sparkModel);
  const contents = `Create high-fidelity technical spec for: "${task.title}".
  
  Return JSON: { "title": "...", "purpose": "...", "rationale": "...", "implementation_details": "..." }`;

  const response = await geminiRequest(
    model,
    contents,
    undefined,
    { responseMimeType: "application/json" }
  );

  return safeJsonParse(response, { title: task.title, purpose: task.description, rationale: 'Generated from directive', implementation_details: 'TBD' });
};

export const listAvailableModels = async () => {
  try {
    const auth = await getAuth();
    if (!auth.token && !auth.apiKey) throw new Error('No credentials');

    const headers: Record<string, string> = {};
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;

    // Use backend proxy for list models
    const res = await fetch(`${API_BASE_URL}/models`, {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    return await res.json();
  } catch (e: any) {
    console.error('List models error:', e);
    return { error: e.message };
  }
};

