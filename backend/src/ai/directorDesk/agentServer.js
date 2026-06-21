import {
  buildProjectBrain,
  getDirectorProject,
  insertDirectorChatMessage,
  listDirectorChat,
  insertSideMessage,
  createSideThread,
  closeSideThread,
  listSideMessages,
  listSideThreads,
} from '../../db/directorDeskModels.js';
import { listAssets, getEpisodePlan } from '../../db/episodeModels.js';
import { routeIntent, INTENTS } from './intentRouter.js';
import {
  resolveWizardMode,
  getStepPrompt,
  getAllowedToolNames,
  FREE_STEP,
} from './wizardStateMachine.js';
import { getToolDefinitions, executeTool } from './agentTools.js';
import { buildEpisodeStoryboardMock } from './storyboardMock.js';

function buildMicroRag(projectId, episodePlanId) {
  const brain = buildProjectBrain(projectId, { episodePlanId });
  const allAssets = listAssets();
  
  if (!brain) return '';
  const lines = [
    `[SYSTEM: Projekt="${brain.project.name}" wizard=${brain.project.wizard_step}]`,
  ];
  if (brain.project.canon?.style_text) {
    lines.push(`[KANON STYL: ${brain.project.canon.style_text}]`);
  }
  if (brain.episode) {
    lines.push(`[ODCINEK: ${brain.episode.code} — ${brain.episode.logline || brain.episode.title}]`);
    lines.push(`[SCEN: ${brain.episode.scenes?.length ?? 0}]`);
  }
  if (brain.generator_tags?.length) {
    lines.push(`[TAGI: ${brain.project.generator_tags.join(', ')}]`);
  }
  if (allAssets?.length) {
    lines.push(`[DOSTĘPNE ASSETY W KATALOGU: ${allAssets.map(a => `${a.name} (ID: ${a.id}, typ: ${a.type})`).join(', ')}]`);
  }
  return lines.join('\n');
}

async function callGroqAgent({ system, userMessage, tools }) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const body = {
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.3,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
  };

  if (tools?.length) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    body.tool_choice = 'auto';
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Groq agent error: ${res.status}`);
  return res.json();
}

function widgetsFromToolResult(toolName, result) {
  const widgets = [];

  if (toolName === 'upsertScene' || toolName === 'buildStoryboardMock') {
    const storyboard = result.scenes
      ? result
      : buildEpisodeStoryboardMock(result);
    for (const scene of storyboard.scenes || []) {
      widgets.push({ type: 'SceneCard', props: scene });
    }
  }

  if (toolName === 'previewWorkflow') {
    widgets.push({ type: 'WorkflowPreview', props: { rules: result.rules, render_params: result.render_params } });
  }

  if (toolName === 'requestAssetUpload' && result.widget) {
    widgets.push({ type: result.widget, props: result });
  }

  if (toolName === 'proposeProjectChange') {
    widgets.push({ type: 'ConfirmationCard', props: result });
  }

  if (toolName === 'startEpisodeWizard' || toolName === 'createEpisodePlan') {
    widgets.push({ type: 'ConfirmationCard', props: { message: `Odcinek "${result.title}" został utworzony. Przejdź do zakładki z odcinkiem aby pracować nad nim.`, action: { type: 'redirect', url: `/desk/${result.project_id || ''}?episode=${result.id}` } } });
  }

  if (toolName === 'produceEpisode') {
    widgets.push({ type: 'ProductionTrigger', props: { episode_plan_id: result.episode_plan_id, message: result.message } });
  }

  return widgets;
}

function runHeuristicAgent(message, ctx) {
  const text = message.toLowerCase();
  const actions = [];

  if (ctx.mode === 'series' && ctx.activeStep === 'series_start' && text.length > 3) {
    actions.push({ tool: 'setProjectName', args: { name: message.slice(0, 80), description: message } });
    actions.push({ tool: 'updateCanonStyle', args: { style_text: message } });
    actions.push({ tool: 'advanceWizard', args: {} });
  } else if (text.includes('storyboard') || text.includes('scen')) {
    const scenes = [
      { description_pl: message, duration_sec: 4, sort_order: 0 },
      { description_pl: 'Kontynuacja akcji — ujęcie średnie.', duration_sec: 4, sort_order: 1 },
    ];
    for (const s of scenes) {
      actions.push({ tool: 'upsertScene', args: s });
    }
    actions.push({ tool: 'buildStoryboardMock', args: {} });
  } else if (text.includes('zatwierdz') || text.includes('akceptuj')) {
    actions.push({ tool: 'confirmCanon', args: {} });
    actions.push({ tool: 'advanceWizard', args: {} });
  }

  return actions;
}

async function runBrainstorm(message, ctx) {
  const rag = buildMicroRag(ctx.projectId, ctx.episodePlanId);
  const system = `Jesteś pomocnym asystentem Kebabkiller Studio (tryb read-only).
Wyjaśniaj technikalia bez modyfikacji projektu. Odpowiadaj po polsku, krótko.
${rag}`;

  try {
    const data = await callGroqAgent({ system, userMessage: message, tools: [] });
    const content = data?.choices?.[0]?.message?.content;
    if (content) return { text: content, source: 'groq' };
  } catch (err) {
    console.warn('[DirectorAgent] brainstorm fallback:', err.message);
    return {
      text: 'To parametry kamery i stylu wpływające na render GPU. W głównym czacie wydaj polecenie fabularne — ja przetłumaczę je na ustawienia w lewym panelu.',
      source: 'fallback',
      llm_error: err.message,
    };
  }

  return {
    text: 'To parametry kamery i stylu wpływające na render GPU. W głównym czacie wydaj polecenie fabularne — ja przetłumaczę je na ustawienia w lewym panelu.',
    source: 'fallback',
  };
}

async function runProjectAgent(message, ctx) {
  const rag = buildMicroRag(ctx.projectId, ctx.episodePlanId);
  const allowed = getAllowedToolNames(ctx.mode, ctx.activeStep);
  const tools = getToolDefinitions(allowed);

  const system = `[Director's Desk Agent]
Jesteś sztuczną inteligencją w trybie "${ctx.mode}" na etapie kreatora "${ctx.activeStep}".
Twoim celem jest pomoc użytkownikowi w przejściu do kolejnego kroku lub wykonanie jego poleceń za pomocą Dostępnych Narzędzi.

Oto Twój cel w tym kroku: ${getStepPrompt(ctx.mode, ctx.activeStep)}
Dozwolone narzędzia: ${allowed.join(', ')}

Kontekst projektu:
${rag}

ZASADY:
1. Zawsze wywołuj dozwolone narzędzia, aby realizować cele i polecenia użytkownika (np. "dodaj do kanonu" -> linkCanonAsset). Jeśli zadanie tego wymaga, możesz wywołać kilka narzędzi jedno po drugim w tej samej odpowiedzi. W szczególności, po wykonaniu głównej akcji kroku (np. confirmCanon), wywołaj również advanceWizard, aby przejść dalej.
2. Jeśli prośba użytkownika wykracza poza dozwolone narzędzia w obecnym kroku, lub nie da się jej zrealizować, odpowiedz ZWYKŁYM TEKSTEM (po polsku), grzecznie instruując użytkownika co musi teraz zrobić. 
3. Jeśli narzędzie wykonano pomyślnie, również podaj krótkie podsumowanie w treści wiadomości tekstowej. Nigdy nie odpowiadaj pustym tekstem.
4. Odpowiadaj bezpośrednio do użytkownika (po polsku).`;

  try {
    const data = await callGroqAgent({ system, userMessage: message, tools });
    const choice = data?.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls || [];

    if (toolCalls.length) {
      const results = [];
      const widgets = [];
      let combinedContent = choice.content || '';
      
      for (const call of toolCalls) {
        const args = JSON.parse(call.function.arguments || '{}');
        const result = await executeTool(call.function.name, args, ctx);
        results.push({ tool: call.function.name, result });
        widgets.push(...widgetsFromToolResult(call.function.name, result));
        
        if (!combinedContent) {
          if (call.function.name === 'advanceWizard' && !result.ok) {
            combinedContent = `Nie mogę jeszcze przejść dalej. ${result.reason}`;
          } else if (call.function.name === 'linkCanonAsset') {
            combinedContent = `Dodałem asset do kanonu.`;
          } else if (call.function.name === 'updateCanonStyle') {
            combinedContent = `Zaktualizowałem styl kanonu.`;
          } else if (call.function.name === 'createEpisodePlan') {
            combinedContent = `Utworzyłem plan odcinka. Rozbijmy go teraz na sceny.`;
          } else if (call.function.name === 'upsertScene') {
            combinedContent = `Zaktualizowałem scenę.`;
          } else {
            combinedContent = `Wykonałem akcję (${call.function.name}).`;
          }
        }
      }
      return {
        text: combinedContent,
        tool_results: results,
        widgets,
        source: 'groq-tools',
      };
    }

    if (choice?.content) {
      return { text: choice.content, widgets: [], source: 'groq' };
    }
  } catch (err) {
    console.warn('[DirectorAgent] tool agent failed:', err.message);
    const heuristicActions = runHeuristicAgent(message, ctx);
    if (heuristicActions.length) {
      const results = [];
      const widgets = [];
      for (const { tool, args } of heuristicActions) {
        try {
          const result = await executeTool(tool, args, ctx);
          results.push({ tool, result });
          widgets.push(...widgetsFromToolResult(tool, result));
        } catch (actionErr) {
          results.push({ tool, error: actionErr.message });
        }
      }
      return {
        text: 'Przetworzyłem Twoją wiadomość i zaktualizowałem projekt.',
        tool_results: results,
        widgets,
        source: 'heuristic',
        llm_error: err.message,
      };
    }
    return {
      text: getStepPrompt(ctx.mode, ctx.activeStep),
      widgets: [],
      source: 'prompt',
      llm_error: err.message,
    };
  }

  const heuristicActions = runHeuristicAgent(message, ctx);
  if (heuristicActions.length) {
    const results = [];
    const widgets = [];
    for (const { tool, args } of heuristicActions) {
      try {
        const result = await executeTool(tool, args, ctx);
        results.push({ tool, result });
        widgets.push(...widgetsFromToolResult(tool, result));
      } catch (actionErr) {
        results.push({ tool, error: actionErr.message });
      }
    }
    return {
      text: 'Przetworzyłem Twoją wiadomość i zaktualizowałem projekt.',
      tool_results: results,
      widgets,
      source: 'heuristic',
    };
  }

  return {
    text: getStepPrompt(ctx.mode, ctx.activeStep),
    widgets: [],
    source: 'prompt',
  };
}

export async function handleDirectorMessage({
  projectId,
  episodePlanId,
  message,
  confirmAction,
  sideThreadId,
}) {
  const project = getDirectorProject(projectId);
  if (!project) throw new Error('Projekt nie istnieje.');

  const episode = episodePlanId ? getEpisodePlan(episodePlanId) : null;
  const mode = resolveWizardMode({
    projectStep: project.wizard_step,
    episodeStep: episode?.wizard_step,
    episodePlanId,
  });

  const activeStep = mode === 'episode'
    ? (episode?.wizard_step || 'episode_start')
    : mode === 'series'
      ? project.wizard_step
      : FREE_STEP;

  const ctx = { projectId, episodePlanId, mode, activeStep, episode, project };

  if (confirmAction?.action) {
    const result = await executeTool(confirmAction.action.tool, confirmAction.action.args || {}, ctx);
    const assistantMsg = insertDirectorChatMessage({
      projectId,
      episodePlanId,
      role: 'assistant',
      content: confirmAction.summary || 'Zmiana zatwierdzona.',
      intent: INTENTS.PROJECT_COMMAND,
      widgets: widgetsFromToolResult(confirmAction.action.tool, result),
    });
    return {
      brain: buildProjectBrain(projectId, { episodePlanId }),
      messages: [assistantMsg],
      wizard: { mode, step: activeStep },
    };
  }

  const userMsg = insertDirectorChatMessage({
    projectId,
    episodePlanId,
    role: 'user',
    content: message,
  });

  const routed = await routeIntent(message, {
    wizardMode: mode,
    inWizard: mode !== 'free',
  });

  let response;
  if (routed.intent === INTENTS.CREATIVE_BRAINSTORM) {
    let threadId = sideThreadId;
    if (!threadId) {
      const thread = createSideThread({
        projectId,
        episodePlanId,
        title: message.slice(0, 60),
      });
      threadId = thread.id;
    }
    insertSideMessage({ threadId, role: 'user', content: message });
    response = await runBrainstorm(message, ctx);
    insertSideMessage({ threadId, role: 'assistant', content: response.text });
    const assistantMsg = insertDirectorChatMessage({
      projectId,
      episodePlanId,
      role: 'assistant',
      content: response.text,
      intent: routed.intent,
      widgets: [{ type: 'SideThread', props: { thread_id: threadId, preview: response.text.slice(0, 120) } }],
    });
    return {
      brain: buildProjectBrain(projectId, { episodePlanId }),
      messages: [userMsg, assistantMsg],
      side_thread_id: threadId,
      wizard: { mode, step: activeStep },
      intent: routed.intent,
    };
  }

  response = await runProjectAgent(message, ctx);

  const assistantMsg = insertDirectorChatMessage({
    projectId,
    episodePlanId,
    role: 'assistant',
    content: response.text,
    intent: routed.intent,
    widgets: response.widgets,
    pendingAction: response.pending_action,
  });

  const refreshedProject = getDirectorProject(projectId);
  const refreshedEpisode = episodePlanId ? getEpisodePlan(episodePlanId) : null;
  const newStep = mode === 'episode'
    ? refreshedEpisode?.wizard_step
    : refreshedProject?.wizard_step;

  const finalStep = newStep || activeStep;
  return {
    brain: buildProjectBrain(projectId, { episodePlanId }),
    messages: [userMsg, assistantMsg],
    wizard: { mode, step: finalStep, prompt: getStepPrompt(mode, finalStep) },
    intent: routed.intent,
    tool_results: response.tool_results,
  };
}

export async function handleSideThreadMessage({ threadId, message, projectId, episodePlanId }) {
  insertSideMessage({ threadId, role: 'user', content: message });
  const response = await runBrainstorm(message, { projectId, episodePlanId });
  insertSideMessage({ threadId, role: 'assistant', content: response.text });

  return {
    messages: listSideMessages(threadId),
    reply: response.text,
  };
}

export function getDirectorDeskState(projectId, episodePlanId) {
  const project = getDirectorProject(projectId);
  if (!project) throw new Error('Projekt nie istnieje.');

  const episode = episodePlanId ? getEpisodePlan(episodePlanId) : null;
  const mode = resolveWizardMode({
    projectStep: project.wizard_step,
    episodeStep: episode?.wizard_step,
    episodePlanId,
  });

  const step = mode === 'episode'
    ? episode?.wizard_step
    : mode === 'series'
      ? project.wizard_step
      : FREE_STEP;

  return {
    brain: buildProjectBrain(projectId, { episodePlanId }),
    chat: listDirectorChat(projectId, { episodePlanId }),
    wizard: { mode, step, prompt: getStepPrompt(mode, step) },
    side_threads: listSideThreads(projectId),
  };
}

export async function closeSideThreadAndMerge({ threadId, projectId, episodePlanId, decision }) {
  closeSideThread(threadId);
  if (decision?.trim()) {
    return handleDirectorMessage({
      projectId,
      episodePlanId,
      message: decision,
    });
  }
  return { brain: buildProjectBrain(projectId, { episodePlanId }), closed: true };
}

export { buildProjectBrain, listDirectorChat };
