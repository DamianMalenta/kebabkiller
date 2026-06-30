import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRunComfyWorkflow,
  WEBM_OUTPUT_NODE_ID,
  WEBP_OUTPUT_NODE_ID,
} from './runComfyEngine.js';
import { resolveWanRenderParams, WAN_QUALITY } from './wanConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const WAN_WORKFLOW_TEMPLATE_PATH = path.join(__dirname, 'wan_workflow_api.json');

/** Nodes present in payload sent to RunComfy Serverless (node 51 WEBP excluded). */
export const EXPECTED_PAYLOAD_NODE_IDS = [
  '49', '50', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62',
];

export const REQUIRED_CLASS_TYPES = {
  49: 'VAEDecode',
  50: 'VAELoader',
  52: 'SaveWEBM',
  53: 'CLIPTextEncode',
  54: 'WanImageToVideo',
  55: 'CLIPTextEncode',
  56: 'KSampler',
  57: 'CLIPVisionLoader',
  58: 'CLIPVisionEncode',
  59: 'LoadImage',
  60: 'CLIPLoader',
  61: 'UNETLoader',
  62: 'ModelSamplingSD3',
};

export const EXPECTED_MODEL_PATHS = {
  vae: 'wan_2.1_vae.safetensors',
  clipVision: 'clip_vision_h.safetensors',
  clipWan: 'umt5_xxl_fp8_e4m3fn_scaled.safetensors',
  unet: 'wan2.1/wan2.1_i2v_480p_14B_bf16.safetensors',
};

function finding(level, code, message, details = null) {
  return { level, code, message, details };
}

export function loadWorkflowTemplate(templatePath = WAN_WORKFLOW_TEMPLATE_PATH) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Brak pliku workflow: ${templatePath}`);
  }
  return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
}

export function auditWorkflowTemplate(template) {
  const findings = [];

  if (template[WEBP_OUTPUT_NODE_ID]) {
    findings.push(finding(
      'WARN',
      'template_has_node_51',
      `Szablon zawiera node ${WEBP_OUTPUT_NODE_ID} (WEBP) — buildRunComfyWorkflow usuwa go przed wysyłką`,
    ));
  }

  for (const [nodeId, classType] of Object.entries(REQUIRED_CLASS_TYPES)) {
    if (!template[nodeId]) {
      findings.push(finding('FAIL', 'template_missing_node', `Brak node ${nodeId} w wan_workflow_api.json`));
      continue;
    }
    if (template[nodeId].class_type !== classType) {
      findings.push(finding(
        'FAIL',
        'template_wrong_class',
        `Node ${nodeId}: oczekiwano ${classType}, jest ${template[nodeId].class_type}`,
      ));
    }
  }

  if (template['50']?.inputs?.vae_name !== EXPECTED_MODEL_PATHS.vae) {
    findings.push(finding(
      'WARN',
      'model_vae_path',
      `Node 50 vae_name: ${template['50']?.inputs?.vae_name ?? '(brak)'}`,
      { expected: EXPECTED_MODEL_PATHS.vae },
    ));
  }

  if (template['57']?.inputs?.clip_name !== EXPECTED_MODEL_PATHS.clipVision) {
    findings.push(finding(
      'WARN',
      'model_clip_vision_path',
      `Node 57 clip_name: ${template['57']?.inputs?.clip_name ?? '(brak)'}`,
      { expected: EXPECTED_MODEL_PATHS.clipVision },
    ));
  }

  if (template['60']?.inputs?.clip_name !== EXPECTED_MODEL_PATHS.clipWan) {
    findings.push(finding(
      'WARN',
      'model_clip_wan_path',
      `Node 60 clip_name: ${template['60']?.inputs?.clip_name ?? '(brak)'}`,
      { expected: EXPECTED_MODEL_PATHS.clipWan },
    ));
  }

  if (template['60']?.inputs?.type !== 'wan') {
    findings.push(finding('FAIL', 'clip_not_wan', 'Node 60 CLIPLoader type musi być "wan"'));
  }

  if (template['61']?.inputs?.unet_name !== EXPECTED_MODEL_PATHS.unet) {
    findings.push(finding(
      'WARN',
      'model_unet_path',
      `Node 61 unet_name: ${template['61']?.inputs?.unet_name ?? '(brak)'}`,
      { expected: EXPECTED_MODEL_PATHS.unet },
    ));
  }

  if (template['52']?.inputs?.fps !== 24) {
    findings.push(finding('WARN', 'savewebm_fps', `SaveWEBM fps: ${template['52']?.inputs?.fps ?? '(brak)'} (oczekiwano 24)`));
  }

  return findings;
}

export function auditBuiltPayload(payload, options = {}) {
  const findings = [];
  const graph = payload?.workflow_api_json;
  const expectedLength = options.expectedLength ?? graph?.['54']?.inputs?.length ?? resolveWanRenderParams().length;

  if (!graph) {
    findings.push(finding('FAIL', 'no_workflow_api_json', 'buildRunComfyWorkflow nie zwrócił workflow_api_json'));
    return findings;
  }

  if (payload.overrides) {
    findings.push(finding('FAIL', 'uses_overrides', 'Payload używa overrides zamiast workflow_api_json'));
  }

  if (graph[WEBP_OUTPUT_NODE_ID]) {
    findings.push(finding('FAIL', 'payload_has_node_51', `Node ${WEBP_OUTPUT_NODE_ID} (WEBP) nie powinien być w payloadzie`));
  }

  const nodeIds = Object.keys(graph).sort((a, b) => Number(a) - Number(b));
  const expected = [...EXPECTED_PAYLOAD_NODE_IDS].sort((a, b) => Number(a) - Number(b));

  if (nodeIds.join(',') !== expected.join(',')) {
    findings.push(finding(
      'FAIL',
      'payload_node_mismatch',
      `Nody payload: ${nodeIds.join(', ')}`,
      { expected: expected.join(', ') },
    ));
  }

  for (const [nodeId, classType] of Object.entries(REQUIRED_CLASS_TYPES)) {
    if (graph[nodeId]?.class_type !== classType) {
      findings.push(finding(
        'FAIL',
        'payload_wrong_class',
        `Node ${nodeId}: oczekiwano ${classType}, jest ${graph[nodeId]?.class_type ?? '(brak)'}`,
      ));
    }
  }

  const n54 = graph['54']?.inputs;
  if (n54?.width !== WAN_QUALITY.width || n54?.height !== WAN_QUALITY.height) {
    findings.push(finding(
      'FAIL',
      'payload_resolution',
      `Node 54: ${n54?.width}×${n54?.height} (oczekiwano ${WAN_QUALITY.width}×${WAN_QUALITY.height})`,
    ));
  }

  if (n54?.length !== expectedLength) {
    findings.push(finding(
      'FAIL',
      'payload_wan_length',
      `Node 54 length: ${n54?.length} (oczekiwano ${expectedLength})`,
    ));
  }

  if (graph[WEBM_OUTPUT_NODE_ID]?.class_type !== 'SaveWEBM') {
    findings.push(finding('FAIL', 'no_savewebm', `Brak SaveWEBM na node ${WEBM_OUTPUT_NODE_ID}`));
  }

  return findings;
}

export function auditWorkflowContract(options = {}) {
  const template = options.template ?? loadWorkflowTemplate(options.templatePath);
  const templateFindings = auditWorkflowTemplate(template);

  const payload = buildRunComfyWorkflow(
    'audit-dry',
    'audit prompt',
    { positive_prompt: 'audit positive', negative_prompt: 'audit negative' },
    { startFrame: { type: 'base64', data: 'data:image/jpeg;base64,abc' } },
  );
  const payloadFindings = auditBuiltPayload(payload, {
    expectedLength: payload.workflow_api_json?.['54']?.inputs?.length,
  });

  return {
    templatePath: options.templatePath ?? WAN_WORKFLOW_TEMPLATE_PATH,
    templateFindings,
    payloadFindings,
    findings: [...templateFindings, ...payloadFindings],
  };
}
