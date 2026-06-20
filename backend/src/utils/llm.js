/**
 * Shared LLM calling utilities — single source of truth for all AI provider calls.
 *
 * Each provider function handles: API key check, request construction, fetch, response parsing.
 * Callers pass system prompt, user message, and optional config overrides.
 */

import { parseJsonFromText } from './json.js';

/**
 * Call Groq chat completions API.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {object} [options]
 * @param {string}  [options.model]        - override model (default: env GROQ_MODEL or 'llama-3.3-70b-versatile')
 * @param {number}  [options.temperature]  - default 0.3
 * @param {boolean} [options.jsonMode]     - if true, sets response_format: json_object (default true)
 * @param {number}  [options.maxTokens]    - optional max_tokens
 * @param {object[]} [options.tools]       - optional tools array for function calling
 * @param {string}  [options.toolChoice]   - optional tool_choice ('auto', 'none', etc.)
 * @param {number}  [options.timeoutMs]    - optional fetch timeout in ms
 * @returns {Promise<object|string|null>}  parsed JSON (when jsonMode) or raw content string; null if no API key
 */
export async function callGroq(systemPrompt, userMessage, {
  model,
  temperature = 0.3,
  jsonMode = true,
  maxTokens,
  tools,
  toolChoice,
  timeoutMs,
} = {}) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  const body = {
    model: model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };
  if (maxTokens) body.max_tokens = maxTokens;
  if (tools?.length) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = toolChoice || 'auto';
  }

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  };

  if (timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    fetchOptions.signal = controller.signal;
    try {
      return await _doGroqFetch(fetchOptions, jsonMode, tools);
    } finally {
      clearTimeout(timer);
    }
  }

  return _doGroqFetch(fetchOptions, jsonMode, tools);
}

async function _doGroqFetch(fetchOptions, jsonMode, tools) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', fetchOptions);
  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`);
  const data = await res.json();

  if (tools?.length) return data;

  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  if (jsonMode) return parseJsonFromText(content);
  return content;
}

/**
 * Call OpenAI chat completions API.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {object} [options]
 * @param {string}  [options.model]        - override model (default: env OPENAI_MODEL or 'gpt-4o-mini')
 * @param {number}  [options.temperature]  - default 0.2
 * @param {boolean} [options.jsonMode]     - if true, sets response_format: json_object (default true)
 * @param {number}  [options.maxTokens]    - optional max_tokens
 * @param {number}  [options.timeoutMs]    - optional fetch timeout in ms
 * @returns {Promise<object|string|null>}  parsed JSON (when jsonMode) or raw content string; null if no API key
 */
export async function callOpenAI(systemPrompt, userMessage, {
  model,
  temperature = 0.2,
  jsonMode = true,
  maxTokens,
  timeoutMs,
} = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const body = {
    model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };
  if (maxTokens) body.max_tokens = maxTokens;

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  };

  if (timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    fetchOptions.signal = controller.signal;
    try {
      return await _doOpenAIFetch(fetchOptions, jsonMode);
    } finally {
      clearTimeout(timer);
    }
  }

  return _doOpenAIFetch(fetchOptions, jsonMode);
}

async function _doOpenAIFetch(fetchOptions, jsonMode) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', fetchOptions);
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  if (jsonMode) return parseJsonFromText(content);
  return content;
}

/**
 * Call Anthropic messages API.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {object} [options]
 * @param {string} [options.model]       - default 'claude-3-5-haiku-20241022'
 * @param {number} [options.temperature] - default 0.2
 * @param {number} [options.maxTokens]   - default 2048
 * @returns {Promise<object|null>}       parsed JSON or null if no API key
 */
export async function callAnthropic(systemPrompt, userMessage, {
  model = 'claude-3-5-haiku-20241022',
  temperature = 0.2,
  maxTokens = 2048,
} = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      temperature,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const match = data.content?.[0]?.text?.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Anthropic returned no JSON');
  return JSON.parse(match[0]);
}

/**
 * Call Google Gemini generateContent API.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {object} [options]
 * @param {string} [options.model]       - default env GEMINI_MODEL or 'gemini-2.0-flash'
 * @param {number} [options.temperature] - default 0.2
 * @returns {Promise<object|null>}       parsed JSON or null if no API key
 */
export async function callGemini(systemPrompt, userMessage, {
  model,
  temperature = 0.2,
} = {}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const modelName = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { temperature, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return parseJsonFromText(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

/**
 * Try multiple LLM providers in order, with optional retry logic.
 * @param {Array<{name: string, call: () => Promise<*>}>} providers
 * @param {object} [options]
 * @param {number} [options.maxRetries] - retries per provider (default 1 = no retry)
 * @param {number} [options.baseDelayMs] - base delay for exponential backoff (default 1000)
 * @param {string} [options.logPrefix] - prefix for console.warn messages
 * @returns {Promise<{result: *, source: string} | null>}
 */
export async function tryProviders(providers, {
  maxRetries = 1,
  baseDelayMs = 1000,
  logPrefix = '[LLM]',
} = {}) {
  for (const provider of providers) {
    let delay = baseDelayMs;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await provider.call();
        if (result != null) {
          return { result, source: provider.name };
        }
        break;
      } catch (err) {
        const msg = err.message || '';
        const isRetryable = /(503|429|Too Many Requests|fetch failed|ECONNRESET|500|502)/i.test(msg);
        if (isRetryable && attempt < maxRetries) {
          console.warn(`${logPrefix} ${provider.name} overloaded. Attempt ${attempt}/${maxRetries}. Waiting ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        console.warn(`${logPrefix} ${provider.name} failed:`, err.message);
        break;
      }
    }
  }
  return null;
}

/**
 * Returns which LLM providers have API keys configured.
 */
export function getLlmProviderStatus() {
  return {
    node_options: process.env.NODE_OPTIONS || null,
    configured: {
      gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
      groq: Boolean(process.env.GROQ_API_KEY?.trim()),
      openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    },
  };
}
