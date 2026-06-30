/**
 * fal.ai Multi-Engine Router
 * Supports: Kling 2.5 Pro (default), Kling 2.1 Pro, WAN 2.1 I2V, WAN 2.2 I2V
 *
 * Key advantages over RunComfy:
 * - No cold start (serverless queue)
 * - Webhooks or polling — both supported
 * - Kling: much better character & background consistency
 * - Kling: explicit negative prompts prevent spinning
 * - Cost: Kling 2.5 Turbo ~$0.10/5s clip vs RunComfy GPU fees
 */

import fs from 'node:fs';
import path from 'node:path';
import { buildStartFrameAsset } from './compositeStartFrame.js';
import { ensureOutputDir, resolveOutputPath } from './paths.js';
import { sleep, emitProgress } from '../utils/async.js';

// ─── Model registry ───────────────────────────────────────────────────────────

const FAL_MODELS = {
  // Kling 3.0 Pro — najlepsza jakość, $0.112/s → 5s ≈ $0.56
  'kling-3.0-pro':     'fal-ai/kling-video/v3/pro/image-to-video',
  // Kling 2.5 Turbo Pro — dobra jakość, szybszy, $0.07/s → 5s ≈ $0.35
  'kling-2.5-turbo':   'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
  // Alias "pro" → turbo (v2.5 non-turbo nie istnieje osobno)
  'kling-2.5-pro':     'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
  // Kling 2.1 Pro — stabilny, $0.07/s → 5s ≈ $0.35
  'kling-2.1-pro':     'fal-ai/kling-video/v2.1/pro/image-to-video',
  'kling-2.1-std':     'fal-ai/kling-video/v2.1/standard/image-to-video',
  // WAN — tańszy ($0.05/s), ale gorszy character consistency
  'wan-2.1':           'fal-ai/wan/v2.1/i2v',
  'wan-2.2':           'fal-ai/wan/v2.2/i2v',
  'wan-2.5':           'fal-ai/wan/v2.5/i2v',
};

// Kling 2.5 Turbo: $0.07/s, ~30-45s do wyniku, dobra spójność postaci
const DEFAULT_MODEL_KEY = 'kling-2.5-turbo';

/** Kling-specific negative prompt — prevents spinning, floating, BG loss */
const KLING_NEGATIVE_PROMPT =
  'spinning, rotating, revolving, turning around, subject rotation, ' +
  'camera orbit, camera spinning, camera rolling, camera rotation, dolly zoom, ' +
  'background disappearing, changing background, morphing background, ' +
  'floating, levitating, blurry motion, flickering, distorted face, extra limbs, ' +
  'text, watermark, logo';

/** WAN negative prompt */
const WAN_NEGATIVE_PROMPT =
  'spinning, rotating, revolving, camera movement, camera spin, ' +
  'floating, levitating, blurry, watermark, text, low quality, ugly, distorted';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function falHeaders(apiKey) {
  return {
    Authorization: `Key ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function resolveModelEndpoint(directorJson) {
  const key = (
    directorJson?.fal_model ||
    process.env.FAL_MODEL ||
    DEFAULT_MODEL_KEY
  ).toLowerCase();

  const endpoint = FAL_MODELS[key] || FAL_MODELS[DEFAULT_MODEL_KEY];
  const resolvedKey = FAL_MODELS[key] ? key : DEFAULT_MODEL_KEY;
  return { endpoint, modelKey: resolvedKey };
}

function isKlingModel(modelKey) {
  return modelKey.startsWith('kling');
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds a clean natural-language prompt for Kling/WAN from directorJson.
 * Kling understands natural language — keep it concise and motion-focused.
 */
function buildFalPrompt(userPrompt, directorJson, modelKey) {
  const parts = [];

  // 1. Core description from scene
  if (userPrompt?.trim()) parts.push(userPrompt.trim());

  // 2. Character description (if available and not already in prompt)
  const charDesc = directorJson?.character_description || directorJson?.character_desc;
  if (charDesc && !userPrompt?.includes(charDesc?.slice(0, 20))) {
    parts.push(charDesc.trim());
  }

  // 3. Action description
  const actionDesc = directorJson?.action_description || directorJson?.action;
  if (actionDesc) parts.push(actionDesc.trim());

  // 4. For Kling: add explicit motion stability
  if (isKlingModel(modelKey)) {
    parts.push('static camera, no camera movement, character standing still, stable background');
  }

  // 5. Style
  const styleTags = directorJson?.style_tags;
  if (Array.isArray(styleTags) && styleTags.length) {
    parts.push(styleTags.slice(0, 4).join(', '));
  }

  // 6. Format
  parts.push('vertical 9:16 video, high quality, sharp');

  return parts.filter(Boolean).join('. ');
}

function buildNegativePrompt(directorJson, modelKey) {
  const base = isKlingModel(modelKey) ? KLING_NEGATIVE_PROMPT : WAN_NEGATIVE_PROMPT;
  const extra = directorJson?.negative_prompt_extra;
  return extra ? `${base}, ${extra}` : base;
}

// ─── fal.ai REST calls ────────────────────────────────────────────────────────

async function submitFalJob(endpoint, payload, apiKey) {
  const url = `https://queue.fal.run/${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: falHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[fal.ai] Submit failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (!json.request_id) throw new Error(`[fal.ai] No request_id in response: ${JSON.stringify(json)}`);
  return json; // { request_id, status, queue_position, response_url }
}

async function pollFalStatus(endpoint, requestId, apiKey) {
  const url = `https://queue.fal.run/${endpoint}/requests/${requestId}/status`;
  const res = await fetch(url, { headers: falHeaders(apiKey) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[fal.ai] Status check failed ${res.status}: ${text}`);
  }
  return res.json(); // { status: 'IN_QUEUE'|'IN_PROGRESS'|'COMPLETED'|'FAILED', ... }
}

async function getFalResult(endpoint, requestId, apiKey) {
  const url = `https://queue.fal.run/${endpoint}/requests/${requestId}`;
  const res = await fetch(url, { headers: falHeaders(apiKey) });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[fal.ai] Get result failed ${res.status}: ${text}`);
  }
  return res.json(); // { video: { url, content_type, file_name, file_size } }
}

async function downloadFalVideo(videoUrl, outputPath) {
  ensureOutputDir(path.dirname(outputPath));
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`[fal.ai] Download failed ${res.status}: ${videoUrl}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

// ─── Polling loop ─────────────────────────────────────────────────────────────

async function waitForFalResult(endpoint, requestId, apiKey, onProgress) {
  const pollIntervalMs = Number(process.env.FAL_POLL_INTERVAL_MS) || 4000;
  const maxMinutes = Number(process.env.FAL_MAX_POLL_MINUTES) || 10;
  const maxAttempts = Math.ceil((maxMinutes * 60 * 1000) / pollIntervalMs);
  const startMs = Date.now();

  let attempts = 0;

  while (attempts < maxAttempts) {
    await sleep(pollIntervalMs);
    attempts++;

    const elapsedMin = ((Date.now() - startMs) / 60000).toFixed(1);
    const statusData = await pollFalStatus(endpoint, requestId, apiKey);
    const status = statusData.status;

    if (status === 'COMPLETED') {
      emitProgress(onProgress, 95, 'Klip gotowy — pobieram…');
      return getFalResult(endpoint, requestId, apiKey);
    }

    if (status === 'FAILED') {
      const errMsg = statusData.error || statusData.detail || 'Unknown error';
      throw new Error(`[fal.ai] Job failed: ${errMsg}`);
    }

    // IN_QUEUE or IN_PROGRESS — estimate progress
    const queuePos = statusData.queue_position;
    let progressPercent;
    let progressMsg;

    if (status === 'IN_QUEUE') {
      progressPercent = Math.min(30, 5 + attempts * 2);
      progressMsg = queuePos != null
        ? `W kolejce (pozycja ${queuePos})… ${elapsedMin} min`
        : `W kolejce… ${elapsedMin} min`;
    } else {
      // IN_PROGRESS — ramp up 30→90
      progressPercent = Math.min(90, 30 + attempts * 3);
      progressMsg = `Generuję klip… ${elapsedMin} min`;
    }

    console.log(`[fal.ai] ${requestId} | ${status} | attempt ${attempts} | queue_pos=${queuePos ?? '-'} | ${elapsedMin} min`);
    emitProgress(onProgress, progressPercent, progressMsg);
  }

  throw new Error(
    `[fal.ai] Timeout po ${maxMinutes} min (${attempts} prób). request_id=${requestId}`,
  );
}

// ─── Payload builders per model family ───────────────────────────────────────

function buildKlingPayload({ imageDataUri, prompt, negativePrompt, directorJson }) {
  const durationSec = directorJson?.duration_sec ?? 5;
  const duration = durationSec >= 8 ? '10' : '5';

  return {
    image_url: imageDataUri,
    prompt,
    negative_prompt: negativePrompt,
    duration,
    aspect_ratio: '9:16',
    cfg_scale: 0.5,
  };
}

function buildWanPayload({ imageDataUri, prompt, negativePrompt, directorJson }) {
  const durationSec = directorJson?.duration_sec ?? 5;
  const frames = Math.min(241, Math.max(17, Math.round(durationSec * 24)));

  return {
    image_url: imageDataUri,
    prompt,
    negative_prompt: negativePrompt,
    num_frames: frames,
    aspect_ratio: '9:16',
    resolution: '480p',
  };
}

// ─── Main engine factory ──────────────────────────────────────────────────────

export function createFalEngine(outputDir, config = {}) {
  const apiKey = config.FAL_API_KEY || process.env.FAL_API_KEY;
  const uploadsDir = config.UPLOADS_DIR || process.env.UPLOADS_DIR || './uploads';

  if (!apiKey) {
    throw new Error('[fal.ai] FAL_API_KEY is required. Set it in backend/.env');
  }

  ensureOutputDir(outputDir);

  return {
    name: 'fal',

    async render({ jobId, userPrompt, directorJson, renderStrategy, onProgress, outputPath: outputPathOverride, processedAssets: injectedAssets }) {
      console.log(`[fal.ai] Starting render for job ${jobId}`);
      emitProgress(onProgress, 5, 'Przygotowanie klatki startowej…');

      // 1. Resolve model
      const { endpoint, modelKey } = resolveModelEndpoint(directorJson);
      console.log(`[fal.ai] Model: ${modelKey} → ${endpoint}`);

      // 2. Start frame (Ciemnia → injectedAssets; inaczej kolaż 2D)
      emitProgress(
        onProgress,
        10,
        injectedAssets?.startFrame?.source === 'darkroom'
          ? 'Klatka startowa z Kinowej Ciemni…'
          : 'Składanie klatki startowej (postać + tło)…',
      );
      const startFrame = injectedAssets?.startFrame ?? await buildStartFrameAsset({
        characterRef: directorJson?.character_ref,
        backgroundRef: directorJson?.background_ref,
        uploadsDir,
        width: 480,
        height: 832,
        startFrameOverride: directorJson?.start_frame_path,
      });

      if (!startFrame) {
        throw new Error('[fal.ai] Brak klatki startowej — sprawdź character_ref i background_ref w planie sceny.');
      }

      if (startFrame.source === 'continuation') {
        console.log('[fal.ai] Klatka startowa: kadr kontynuacji z poprzedniej sceny.');
      }

      console.log(`[fal.ai] StartFrame source: ${startFrame.source}`);

      // 3. Build prompt
      const prompt = buildFalPrompt(userPrompt, directorJson, modelKey);
      const negativePrompt = buildNegativePrompt(directorJson, modelKey);
      console.log(`[fal.ai] Prompt: ${prompt.slice(0, 120)}…`);

      // 4. Build model payload
      const payloadBase = {
        imageDataUri: startFrame.data,
        prompt,
        negativePrompt,
        directorJson,
      };

      const payload = isKlingModel(modelKey)
        ? buildKlingPayload(payloadBase)
        : buildWanPayload(payloadBase);

      // 5. Submit job to fal.ai queue
      emitProgress(onProgress, 15, `Wysyłam do fal.ai (${modelKey})…`);
      const submitResult = await submitFalJob(endpoint, payload, apiKey);
      console.log(`[fal.ai] Job submitted: ${submitResult.request_id} (queue_pos=${submitResult.queue_position ?? '?'})`);

      emitProgress(onProgress, 20, `W kolejce fal.ai… (ID: ${submitResult.request_id.slice(0, 8)})`);

      // 6. Poll for result
      const result = await waitForFalResult(endpoint, submitResult.request_id, apiKey, onProgress);
      const videoUrl = result?.video?.url || result?.url;
      if (!videoUrl) {
        throw new Error(`[fal.ai] Brak URL wideo w odpowiedzi: ${JSON.stringify(result)}`);
      }

      console.log(`[fal.ai] Video URL: ${videoUrl}`);

      // 7. Download video
      emitProgress(onProgress, 97, 'Pobieram klip…');
      const ext = result?.video?.content_type === 'video/mp4' ? '.mp4' : '.mp4';
      const outputPath = outputPathOverride || resolveOutputPath(outputDir, jobId, ext);
      await downloadFalVideo(videoUrl, outputPath);

      // 8. Save metadata
      const metaPath = outputPath.replace(/\.[^.]+$/, '.meta.json');
      fs.writeFileSync(metaPath, JSON.stringify({
        jobId,
        userPrompt,
        prompt,
        negativePrompt,
        directorConfig: directorJson,
        startFrameSource: startFrame.source,
        model: modelKey,
        falRequestId: submitResult.request_id,
        videoUrl,
        format: '9:16',
        engine: 'fal',
        generatedAt: new Date().toISOString(),
      }, null, 2));

      emitProgress(onProgress, 100, 'Klip gotowy!');
      console.log(`[fal.ai] Job ${jobId} complete → ${outputPath}`);

      return {
        outputPath,
        renderStrategy: renderStrategy || 'native_i2v',
        engine: 'fal',
        model: modelKey,
        falRequestId: submitResult.request_id,
      };
    },
  };
}
