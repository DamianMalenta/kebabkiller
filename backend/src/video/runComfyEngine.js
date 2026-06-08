import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureOutputDir, resolveOutputPath } from './queue.js';
import { buildStartFrameAsset } from './compositeStartFrame.js';
import { WAN_QUALITY } from './wanConfig.js';

export { WAN_QUALITY } from './wanConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW_TEMPLATE_PATH = path.join(__dirname, 'wan_workflow_api.json');

/** SaveWEBM node in wan_workflow_api.json — primary video output */
export const WEBM_OUTPUT_NODE_ID = '52';
/** SaveAnimatedWEBP — excluded from dynamic workflow; kept for pickRunComfyMedia fallback */
export const WEBP_OUTPUT_NODE_ID = '51';

let workflowTemplateCache = null;

function getWorkflowTemplate() {
  if (!workflowTemplateCache) {
    workflowTemplateCache = JSON.parse(fs.readFileSync(WORKFLOW_TEMPLATE_PATH, 'utf8'));
  }
  return workflowTemplateCache;
}

function cloneInputs(nodeId, template) {
  const node = template[String(nodeId)];
  if (!node?.inputs) {
    throw new Error(`Workflow template missing node ${nodeId}`);
  }
  return structuredClone(node.inputs);
}

function formatRunComfyError(errorPayload) {
  if (!errorPayload) return 'unknown error';
  if (typeof errorPayload === 'string') return errorPayload;
  if (Array.isArray(errorPayload)) {
    return errorPayload
      .map((entry) => entry.details || entry.message || entry.error || JSON.stringify(entry))
      .join(' | ');
  }
  return errorPayload.message || JSON.stringify(errorPayload);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectMediaCandidates(outputs) {
  const videoCandidates = [];
  const imageCandidates = [];

  for (const [nodeId, nodeOutput] of Object.entries(outputs || {})) {
    for (const entry of nodeOutput?.videos || []) {
      if (entry?.url) videoCandidates.push({ ...entry, nodeId, kind: 'video' });
    }
    for (const entry of nodeOutput?.images || []) {
      if (entry?.url) imageCandidates.push({ ...entry, nodeId, kind: 'image' });
    }
  }

  return { videoCandidates, imageCandidates };
}

/**
 * Picks the best media from RunComfy result outputs.
 * Priority: node 52 (SaveWEBM) → any .webm → any video → node 51 WEBP (warn) → any image.
 */
export function pickRunComfyMedia(outputs) {
  const { videoCandidates, imageCandidates } = collectMediaCandidates(outputs);

  const node52 = videoCandidates.find((c) => c.nodeId === WEBM_OUTPUT_NODE_ID);
  if (node52) return node52;

  const webm = videoCandidates.find(
    (c) => c.filename?.toLowerCase().endsWith('.webm') || c.url.toLowerCase().includes('.webm'),
  );
  if (webm) return webm;

  if (videoCandidates[0]) return videoCandidates[0];

  const node51 = imageCandidates.find((c) => c.nodeId === WEBP_OUTPUT_NODE_ID);
  if (node51) {
    const nodeIds = Object.keys(outputs || {}).join(', ') || '(puste)';
    console.warn(
      `[RunComfyEngine] Brak WEBM (node ${WEBM_OUTPUT_NODE_ID}) — używam WEBP z node ${WEBP_OUTPUT_NODE_ID}. ` +
      `Nodes w odpowiedzi API: ${nodeIds}. W deployment RunComfy włącz output z SaveWEBM (node 52).`,
    );
    return node51;
  }

  if (imageCandidates[0]) {
    console.warn('[RunComfyEngine] Brak wideo w odpowiedzi — używam pierwszego obrazu.');
    return imageCandidates[0];
  }

  return null;
}

function inferMediaExtension(url, contentType, buffer) {
  const urlLower = (url || '').toLowerCase();
  const typeLower = (contentType || '').toLowerCase();

  if (urlLower.includes('.webm') || typeLower.includes('webm')) return '.webm';
  if (urlLower.includes('.webp') || typeLower.includes('webp')) return '.webp';
  if (urlLower.includes('.mp4') || typeLower.includes('mp4')) return '.mp4';

  if (buffer?.length >= 12) {
    const riff = buffer.toString('ascii', 0, 4);
    const webp = buffer.toString('ascii', 8, 12);
    if (riff === 'RIFF' && webp === 'WEBP') return '.webp';
    if (buffer.toString('ascii', 4, 8) === 'ftyp') return '.mp4';
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return '.webm';
  }

  return '.mp4';
}

/**
 * Builds a full ComfyUI API workflow for RunComfy dynamic inference.
 * Sends workflow_api_json (not overrides) so node 51 WEBP is omitted — only SaveWEBM (52) runs.
 * @see https://docs.runcomfy.com/serverless/async-queue-endpoints
 */
export function buildRunComfyWorkflow(jobId, userPrompt, directorJson, processedAssets) {
  const workflow = structuredClone(getWorkflowTemplate());
  delete workflow[WEBP_OUTPUT_NODE_ID];

  const positivePrompt = directorJson?.positive_prompt || userPrompt;
  const negativePrompt = directorJson?.negative_prompt || 'blurry, worst quality, text, watermark';
  const seed = Math.floor(Math.random() * 1_000_000_000_000);

  workflow['55'].inputs = cloneInputs('55', workflow);
  workflow['55'].inputs.text = positivePrompt;

  workflow['53'].inputs = cloneInputs('53', workflow);
  workflow['53'].inputs.text = negativePrompt;

  workflow['54'].inputs = cloneInputs('54', workflow);
  workflow['54'].inputs.width = WAN_QUALITY.width;
  workflow['54'].inputs.height = WAN_QUALITY.height;
  workflow['54'].inputs.length = WAN_QUALITY.length;

  workflow['56'].inputs = cloneInputs('56', workflow);
  workflow['56'].inputs.seed = seed;
  workflow['56'].inputs.steps = WAN_QUALITY.steps;

  if (processedAssets.startFrame?.type === 'base64') {
    workflow['59'].inputs = cloneInputs('59', workflow);
    workflow['59'].inputs.image = processedAssets.startFrame.data;
  }

  if (!workflow[WEBM_OUTPUT_NODE_ID]) {
    throw new Error(`Workflow template missing SaveWEBM node ${WEBM_OUTPUT_NODE_ID}`);
  }

  return { workflow_api_json: workflow };
}

export function createRunComfyEngine(outputDir, config) {
  ensureOutputDir(outputDir);
  const uploadsDir = config.UPLOADS_DIR;
  const endpoint = config.RUNCOMFY_ENDPOINT;
  const apiKey = config.RUNCOMFY_API_KEY;

  if (!endpoint) {
    console.warn('[RunComfyEngine] RUNCOMFY_ENDPOINT is not set (wymagany format V2: .../deployments/{id}/inference).');
  }
  if (!apiKey) {
    console.warn('[RunComfyEngine] RUNCOMFY_API_KEY is not set. API calls will likely fail.');
  }

  // Funkcja Wake-up (Cold Start)
  async function checkAndWakeCluster(onProgress) {
      console.log(`[RunComfyEngine] Pinging cluster to wake up...`);
      // Tutaj w przyszłości będzie endpoint /status
      // Na ten moment zakładamy, że klaster jest obudzony
      onProgress?.(5);
      await sleep(1000);
      return true;
  }

  // Wysłanie głównego JSONa
  async function submitJob(workflow, jobId) {
      const nodeIds = Object.keys(workflow.workflow_api_json || workflow.overrides || {}).join(', ');
      console.log(
        `[RunComfyEngine] Submitting job ${jobId} to RunComfy` +
        (workflow.workflow_api_json ? ` (workflow_api_json, nodes: ${nodeIds})` : ' (overrides)'),
      );
      const submitResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(workflow)
      });

      const responseText = await submitResponse.text();
      let submitData = {};
      try {
        submitData = responseText ? JSON.parse(responseText) : {};
      } catch {
        submitData = { raw: responseText };
      }

      if (!submitResponse.ok) {
          const detail = submitData.message || submitData.error || responseText || 'no body';
          throw new Error(
            `RunComfy Submit API returned status: ${submitResponse.status} — ${detail}. ` +
            'Sprawdź RUNCOMFY_ENDPOINT (deployment_id z panelu RunComfy → Deployments).'
          );
      }

      const requestId = submitData.request_id || submitData.run_id || submitData.id;
      if (!requestId) {
        throw new Error('RunComfy Submit API: brak request_id w odpowiedzi.');
      }

      console.log(`[RunComfyEngine] Job submitted successfully. request_id: ${requestId}`);
      return {
        requestId,
        statusUrl: submitData.status_url,
        resultUrl: submitData.result_url,
      };
  }

  function deploymentBaseUrl() {
    const match = endpoint.match(/^(https:\/\/api\.runcomfy\.net\/prod\/v2\/deployments\/[^/]+)/i);
    return match ? match[1] : endpoint.replace(/\/inference\/?$/i, '');
  }

  function runComfyPhaseMessage(status, attempts) {
    if (status === 'in_queue') {
      return 'Kolejka RunComfy — cold start GPU (pierwsze uruchomienie ~2–4 min)';
    }
    if (attempts <= 8) {
      return 'Uruchamianie ComfyUI i ładowanie rozszerzeń…';
    }
    if (attempts <= 24) {
      return 'Ładowanie modelu Wan 2.1 14B (~15 GB VRAM)…';
    }
    return 'Generowanie 33 klatek wideo — czas zależy od GPU, nie od długości promptu';
  }

  function runComfyProgressPercent(status, attempts) {
    if (status === 'in_queue') return Math.min(40, 20 + attempts * 3);
    return Math.min(97, 40 + attempts * 1.5);
  }

  function emitProgress(onProgress, percent, message) {
    if (!onProgress) return;
    onProgress(message ? { percent, message } : percent);
  }

  // Pętla pobierająca (Polling Loop)
  async function pollJobStatus(submitResult, onProgress) {
      const { requestId, statusUrl, resultUrl } = submitResult;
      console.log(`[RunComfyEngine] Polling request_id: ${requestId}`);

      const pollUrl = statusUrl || `${deploymentBaseUrl()}/requests/${requestId}/status`;
      const fetchResultUrl = resultUrl || `${deploymentBaseUrl()}/requests/${requestId}/result`;
      const authHeaders = { Authorization: `Bearer ${apiKey}` };

      let attempts = 0;
      const maxAttempts = 120; // ~10 min at 5s

      while (attempts < maxAttempts) {
          attempts++;
          const statusRes = await fetch(pollUrl, { headers: authHeaders });
          const statusText = await statusRes.text();
          let statusData = {};
          try {
            statusData = statusText ? JSON.parse(statusText) : {};
          } catch {
            statusData = {};
          }

          if (!statusRes.ok) {
            throw new Error(`RunComfy status API returned ${statusRes.status}: ${statusText || 'no body'}`);
          }

          const status = statusData.status;
          console.log(`[RunComfyEngine] Poll ${attempts}: ${status}`);

          if (status === 'in_queue') {
            emitProgress(onProgress, runComfyProgressPercent(status, attempts), runComfyPhaseMessage(status, attempts));
          } else if (status === 'in_progress') {
            emitProgress(onProgress, runComfyProgressPercent(status, attempts), runComfyPhaseMessage(status, attempts));
          } else if (status === 'completed') {
            emitProgress(onProgress, 98, 'Pobieranie wyniku…');
            return fetchResultUrl;
          } else if (status === 'cancelled') {
            throw new Error('RunComfy job was cancelled.');
          } else if (status === 'failed') {
            throw new Error(`RunComfy job failed: ${statusData.error?.message || statusText}`);
          }

          await sleep(5000);
      }

      throw new Error(`RunComfy job timed out after ${maxAttempts} polling attempts.`);
  }

  async function downloadVideo(resultUrl, outputDir, jobId) {
      console.log(`[RunComfyEngine] Fetching result from ${resultUrl}`);
      const resultRes = await fetch(resultUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
      const resultText = await resultRes.text();

      if (!resultRes.ok) {
        throw new Error(`RunComfy result API returned ${resultRes.status}: ${resultText || 'no body'}`);
      }

      const resultData = JSON.parse(resultText);

      if (resultData.status === 'failed') {
        throw new Error(`RunComfy render failed: ${formatRunComfyError(resultData.error)}`);
      }

      const outputs = resultData.outputs || {};
      const media = pickRunComfyMedia(outputs);

      if (!media?.url) {
        throw new Error(`RunComfy result has no video/image URL. Raw: ${resultText.slice(0, 500)}`);
      }

      console.log(`[RunComfyEngine] Downloading media (${media.kind}, node ${media.nodeId}): ${media.url}`);
      const mediaRes = await fetch(media.url);
      if (!mediaRes.ok) {
        throw new Error(`Failed to download media (${mediaRes.status}) from ${media.url}`);
      }

      const buffer = Buffer.from(await mediaRes.arrayBuffer());
      const ext = inferMediaExtension(media.url, mediaRes.headers.get('content-type'), buffer);
      const outputPath = resolveOutputPath(outputDir, jobId, ext);
      fs.writeFileSync(outputPath, buffer);
      console.log(`[RunComfyEngine] Saved ${buffer.length} bytes → ${outputPath}`);
      return outputPath;
  }

  return {
    name: 'runcomfy',
    async render({ jobId, userPrompt, directorJson, renderStrategy, onProgress }) {
      console.log(`[RunComfyEngine] Starting render for job ${jobId}`);
        emitProgress(onProgress, 2, 'Przygotowanie zlecenia RunComfy…');
      
      try {
        // Krok 1: Ping & Wake
        const isReady = await checkAndWakeCluster((p) => emitProgress(onProgress, p));
        if (!isReady) throw new Error("Chmura GPU nie odpowiada po fazie budzenia.");

        // Krok 2: Klatka startowa 9:16 (tło + postać → węzeł 59)
        emitProgress(onProgress, 10, 'Składanie klatki startowej (postać + tło)…');
        const startFrame = await buildStartFrameAsset({
          characterRef: directorJson?.character_ref,
          backgroundRef: directorJson?.background_ref,
          uploadsDir,
          width: WAN_QUALITY.width,
          height: WAN_QUALITY.height,
        });
        const processedAssets = { startFrame };

        // Krok 3: Emisja Payloadu JSON (Build & Submit)
        emitProgress(onProgress, 20, 'Wysyłanie workflow na RunComfy…');
        const workflow = buildRunComfyWorkflow(jobId, userPrompt, directorJson, processedAssets);
        const submitResult = await submitJob(workflow, jobId);

        // Krok 4: Prawdziwy Polling Loop (Śledzenie postępu)
        emitProgress(onProgress, 25, 'Zlecenie przyjęte — czekam na GPU…');
        const resultUrl = await pollJobStatus(submitResult, onProgress);

        // Krok 5: Pobranie i Zapis (Download & Cleanup)
        emitProgress(onProgress, 98, 'Pobieranie pliku wideo…');
        const outputPath = await downloadVideo(resultUrl, outputDir, jobId);
        
        // Zapis metadanych (Meta JSON)
        const metaPath = outputPath.replace(/\.[^.]+$/, '.meta.json');
        fs.writeFileSync(metaPath, JSON.stringify({
            jobId,
            userPrompt,
            directorConfig: directorJson,
            startFrameSource: startFrame?.source || null,
            format: '9:16',
            engine: 'runcomfy',
            createdAt: new Date().toISOString(),
        }, null, 2));

        // Krok 6: Oznaczenie czasu do uśpienia (Idle Timer Log)
        emitProgress(onProgress, 100, 'Gotowe');
        console.log(`[RunComfyEngine] Zakończono generację. Zegar bezczynności maszyny (Idle Timer) na RunComfy rozpoczął tykanie.`);

        return {
          outputPath,
          renderStrategy: renderStrategy || directorJson?.render_strategy || 'native_i2v',
          engine: 'runcomfy',
        };

      } catch (err) {
        console.error(`[RunComfyEngine] Fatal error during rendering:`, err);
        throw err;
      }
    },
  };
}
