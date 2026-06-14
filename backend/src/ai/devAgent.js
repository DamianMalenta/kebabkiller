import { listDevMessages, insertDevMessage } from '../db/devAgentModels.js';
import { listVideoJobs, getVideoJob } from '../db/models.js';
import { listEpisodePlans, getEpisodePlan } from '../db/episodeModels.js';
import { getLatestProductionRun } from '../db/productionModels.js';
import { getLlmProviderStatus } from './director.js';

const DEV_SYSTEM_PROMPT = `Jesteś Programistą — asystentem technicznym Kebabkiller Studio.
Twoja rola: diagnostyka systemu, inspekcja jobów, monitorowanie produkcji i odpowiedzi na pytania techniczne.
Odpowiadaj po polsku, konkretnie i technicznie.

ZASADY:
1. Używaj dostępnych narzędzi aby pobrać aktualne dane systemowe przed odpowiedzią.
2. Nigdy nie modyfikujesz danych (brak narzędzi zapisu) — tylko czytasz i analizujesz.
3. Jeśli coś jest podejrzane (np. job stuck, brak outputu, błąd produkcji) — powiedz wprost co może być przyczyną.
4. Cytuj ID jobów, plany, statusy — konkretna informacja, nie ogólniki.
5. Możesz sugerować komendy bash lub kroki do naprawy, ale nie wykonujesz ich samodzielnie.`;

const TOOL_DEFINITIONS = [
  {
    name: 'getSystemHealth',
    description: 'Get backend health: LLM provider status, VIDEO_ENGINE, configured ports and API keys presence (not values)',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'listJobs',
    description: 'List recent video jobs with status, creation time, output path',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max jobs to return (default 20)' },
        status: { type: 'string', description: 'Filter by status (optional)' },
      },
    },
  },
  {
    name: 'getJobDetails',
    description: 'Get full details of a specific video job including director_json',
    parameters: {
      type: 'object',
      properties: {
        job_id: { type: 'string' },
      },
      required: ['job_id'],
    },
  },
  {
    name: 'listEpisodePlans',
    description: 'List episode plans with codes, titles and statuses',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max plans to return (default 10)' },
      },
    },
  },
  {
    name: 'getProductionStatus',
    description: 'Get latest production run for an episode plan',
    parameters: {
      type: 'object',
      properties: {
        episode_plan_id: { type: 'string' },
      },
      required: ['episode_plan_id'],
    },
  },
  {
    name: 'getBackendConfig',
    description: 'Get backend configuration: PORT, VIDEO_ENGINE, WAN_LENGTH, I2V_PROFILE (no secret values)',
    parameters: { type: 'object', properties: {} },
  },
];

function executeDevTool(name, args) {
  switch (name) {
    case 'getSystemHealth': {
      const llm = getLlmProviderStatus();
      return {
        llm_providers: llm,
        video_engine: process.env.VIDEO_ENGINE || 'mock',
        port: process.env.PORT || '4000',
        has_groq_key: Boolean(process.env.GROQ_API_KEY?.trim()),
        has_runcomfy_key: Boolean(process.env.RUNCOMFY_API_KEY?.trim()),
        has_runcomfy_endpoint: Boolean(process.env.RUNCOMFY_ENDPOINT?.trim()),
        node_version: process.version,
        uptime_sec: Math.round(process.uptime()),
      };
    }

    case 'listJobs': {
      const limit = args.limit || 20;
      let jobs = listVideoJobs().slice(0, limit);
      if (args.status) {
        jobs = jobs.filter((j) => j.status === args.status);
      }
      return jobs.map((j) => ({
        id: j.id,
        status: j.status,
        status_message: j.status_message,
        created_at: j.created_at,
        output_path: j.output_path || null,
        project_id: j.project_id || null,
        episode_plan_id: j.episode_plan_id || null,
        is_canon: Boolean(j.is_canon),
      }));
    }

    case 'getJobDetails': {
      const job = getVideoJob(args.job_id);
      if (!job) return { error: `Job ${args.job_id} not found` };
      return {
        ...job,
        director_json: job.director_json ? JSON.parse(job.director_json) : null,
        is_canon: Boolean(job.is_canon),
      };
    }

    case 'listEpisodePlans': {
      const limit = args.limit || 10;
      const plans = listEpisodePlans().slice(0, limit);
      return plans.map((p) => ({
        id: p.id,
        code: p.code,
        title: p.title,
        status: p.status,
        wizard_step: p.wizard_step,
        scene_count: p.scenes?.length ?? 0,
        created_at: p.created_at,
      }));
    }

    case 'getProductionStatus': {
      const run = getLatestProductionRun(args.episode_plan_id);
      const plan = getEpisodePlan(args.episode_plan_id);
      return {
        plan_id: args.episode_plan_id,
        plan_status: plan?.status || 'not_found',
        production_run: run
          ? {
              id: run.id,
              status: run.status,
              started_at: run.started_at,
              completed_at: run.completed_at,
              scene_results: run.scene_results ? JSON.parse(run.scene_results) : null,
            }
          : null,
      };
    }

    case 'getBackendConfig': {
      return {
        port: process.env.PORT || '4000',
        video_engine: process.env.VIDEO_ENGINE || 'mock',
        wan_length: process.env.WAN_LENGTH || '33',
        i2v_profile: process.env.I2V_PROFILE || 'I2V_DEFAULT',
        runcomfy_endpoint_set: Boolean(process.env.RUNCOMFY_ENDPOINT?.trim()),
        groq_model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        node_env: process.env.NODE_ENV || 'development',
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function callGroqDevAgent(messages, tools) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const body = {
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.1,
    messages,
    tools: tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: 'auto',
  };

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq devAgent error ${res.status}: ${errText}`);
  }
  return res.json();
}

export async function handleDevMessage(userMessage) {
  const userMsg = insertDevMessage({ role: 'user', content: userMessage });

  const history = listDevMessages({ limit: 40 });
  const groqMessages = [
    { role: 'system', content: DEV_SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  let finalContent = '';
  let toolCallsLog = [];

  const groqAvailable = Boolean(process.env.GROQ_API_KEY?.trim());

  if (!groqAvailable) {
    // No Groq key — run deterministic fallback
    const healthData = executeDevTool('getSystemHealth', {});
    const jobsData = executeDevTool('listJobs', { limit: 5 });
    const configData = executeDevTool('getBackendConfig', {});
    const plansData = executeDevTool('listEpisodePlans', { limit: 5 });

    finalContent = [
      `**Odpowiedź deterministyczna** (brak klucza GROQ_API_KEY — Programista pracuje bez LLM):`,
      ``,
      `**Backend:**`,
      `- VIDEO_ENGINE: \`${healthData.video_engine}\``,
      `- PORT: \`${healthData.port}\``,
      `- Node.js: \`${healthData.node_version}\`, uptime: ${healthData.uptime_sec}s`,
      `- GROQ key: ${healthData.has_groq_key ? '✓ ustawiony' : '✗ BRAK — dodaj GROQ_API_KEY do .env'}`,
      `- RunComfy key: ${healthData.has_runcomfy_key ? '✓ ustawiony' : '✗ BRAK'}`,
      ``,
      `**Konfiguracja:**`,
      `- WAN_LENGTH: \`${configData.wan_length}\`, I2V_PROFILE: \`${configData.i2v_profile}\``,
      `- GROQ_MODEL: \`${configData.groq_model}\``,
      ``,
      `**Joby (${jobsData.length}):** ${jobsData.length === 0 ? 'brak' : jobsData.slice(0, 3).map((j) => `\`${j.id.slice(0, 8)}\` [${j.status}]`).join(', ')}`,
      `**Plany odcinków (${plansData.length}):** ${plansData.length === 0 ? 'brak' : plansData.map((p) => `${p.code} [${p.status}]`).join(', ')}`,
    ].join('\n');

    toolCallsLog = [
      { tool: 'getSystemHealth', result: healthData },
      { tool: 'listJobs', result: jobsData },
      { tool: 'getBackendConfig', result: configData },
      { tool: 'listEpisodePlans', result: plansData },
    ];
  } else {
    try {
      let data = await callGroqDevAgent(groqMessages, TOOL_DEFINITIONS);
      let choice = data?.choices?.[0]?.message;

      // Agentic loop: handle tool calls (max 3 rounds)
      for (let round = 0; round < 3 && choice?.tool_calls?.length; round++) {
        const toolResults = [];
        for (const call of choice.tool_calls) {
          const args = JSON.parse(call.function.arguments || '{}');
          const result = executeDevTool(call.function.name, args);
          toolResults.push({ name: call.function.name, result });
          toolCallsLog.push({ tool: call.function.name, args, result });
        }

        // Follow-up with tool results
        const followUpMessages = [
          ...groqMessages,
          { role: 'assistant', content: choice.content || '', tool_calls: choice.tool_calls },
          ...toolResults.map((tr, i) => ({
            role: 'tool',
            tool_call_id: choice.tool_calls[i]?.id,
            content: JSON.stringify(tr.result),
          })),
        ];

        data = await callGroqDevAgent(followUpMessages, TOOL_DEFINITIONS);
        choice = data?.choices?.[0]?.message;
      }

      finalContent = choice?.content || 'Gotowe — dane pobrane i przeanalizowane.';
    } catch (err) {
      console.warn('[devAgent] Groq error:', err.message);
      finalContent = `Błąd połączenia z Groq: ${err.message}. Sprawdź klucz GROQ_API_KEY.`;
    }
  }

  const assistantMsg = insertDevMessage({
    role: 'assistant',
    content: finalContent,
    toolCalls: toolCallsLog.length ? toolCallsLog : null,
  });

  return {
    user_message: userMsg,
    assistant_message: assistantMsg,
    tool_calls: toolCallsLog,
  };
}

export function getDevAgentState() {
  const messages = listDevMessages({ limit: 200 });
  const health = executeDevTool('getSystemHealth', {});
  const config = executeDevTool('getBackendConfig', {});
  const recentJobs = executeDevTool('listJobs', { limit: 10 });
  const plans = executeDevTool('listEpisodePlans', { limit: 5 });

  return {
    messages,
    system: { health, config, recent_jobs: recentJobs, episode_plans: plans },
  };
}
