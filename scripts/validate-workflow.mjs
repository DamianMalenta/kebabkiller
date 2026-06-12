#!/usr/bin/env node
/**
 * Validates backend/src/video/wan_workflow_api.json against infra/runcomfy-minimal.spec.json.
 * Used in CI and locally before RunComfy deployment changes.
 *
 * Usage: node scripts/validate-workflow.mjs
 * Exit 0 = OK, 1 = validation errors.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = path.join(ROOT, 'infra', 'runcomfy-minimal.spec.json');
const WORKFLOW_PATH = path.join(ROOT, 'backend', 'src', 'video', 'wan_workflow_api.json');

const errors = [];

function fail(message) {
  errors.push(message);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing ${label}: ${path.relative(ROOT, filePath)}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`Invalid JSON in ${label}: ${err.message}`);
    return null;
  }
}

function findNodeByClass(workflow, classType) {
  return Object.entries(workflow).find(([, node]) => node?.class_type === classType);
}

function main() {
  const spec = readJson(SPEC_PATH, 'spec');
  const workflow = readJson(WORKFLOW_PATH, 'workflow');
  if (!spec || !workflow) {
    reportAndExit();
    return;
  }

  const nodeIds = Object.keys(workflow);
  if (nodeIds.length > spec.max_node_count) {
    fail(`Too many nodes (${nodeIds.length}) — max ${spec.max_node_count} for Minimal deployment`);
  }

  for (const [nodeId, reason] of Object.entries(spec.forbidden_nodes || {})) {
    if (workflow[nodeId]) {
      fail(`Forbidden node ${nodeId} present (${workflow[nodeId].class_type}): ${reason}`);
    }
  }

  for (const [nodeId, classType] of Object.entries(spec.required_nodes || {})) {
    const node = workflow[nodeId];
    if (!node) {
      fail(`Missing required node ${nodeId} (${classType})`);
    } else if (node.class_type !== classType) {
      fail(`Node ${nodeId} expected ${classType}, got ${node.class_type}`);
    }
  }

  const presentTypes = new Set(
    Object.values(workflow)
      .map((n) => n?.class_type)
      .filter(Boolean),
  );

  for (const classType of spec.required_class_types || []) {
    if (!presentTypes.has(classType)) {
      fail(`Missing class_type in workflow: ${classType}`);
    }
  }

  const [, vaeNode] = findNodeByClass(workflow, 'VAELoader') || [];
  if (vaeNode?.inputs?.vae_name !== spec.models.vae) {
    fail(`VAELoader vae_name must be "${spec.models.vae}"`);
  }

  const [, unetNode] = findNodeByClass(workflow, 'UNETLoader') || [];
  if (unetNode?.inputs?.unet_name !== spec.models.unet) {
    fail(`UNETLoader unet_name must be "${spec.models.unet}"`);
  }

  const [, clipNode] = findNodeByClass(workflow, 'CLIPLoader') || [];
  if (clipNode?.inputs?.clip_name !== spec.models.clip) {
    fail(`CLIPLoader clip_name must be "${spec.models.clip}"`);
  }
  if (clipNode?.inputs?.type !== spec.models.clip_type) {
    fail(`CLIPLoader type must be "${spec.models.clip_type}"`);
  }

  const [, clipVisionNode] = findNodeByClass(workflow, 'CLIPVisionLoader') || [];
  if (clipVisionNode?.inputs?.clip_name !== spec.models.clip_vision) {
    fail(`CLIPVisionLoader clip_name must be "${spec.models.clip_vision}"`);
  }

  const webm = workflow['52'];
  if (webm) {
    if (webm.inputs?.fps !== spec.wan_quality.savewebm_fps) {
      fail(`SaveWEBM (52) fps must be ${spec.wan_quality.savewebm_fps}`);
    }
    if (webm.inputs?.codec !== spec.wan_quality.savewebm_codec) {
      fail(`SaveWEBM (52) codec must be "${spec.wan_quality.savewebm_codec}"`);
    }
  }

  const ksampler = workflow['56'];
  if (ksampler) {
    if (ksampler.inputs?.steps !== spec.wan_quality.steps) {
      fail(`KSampler (56) steps must be ${spec.wan_quality.steps}`);
    }
    if (ksampler.inputs?.cfg !== spec.wan_quality.cfg) {
      fail(`KSampler (56) cfg must be ${spec.wan_quality.cfg}`);
    }
    if (ksampler.inputs?.sampler_name !== spec.wan_quality.sampler_name) {
      fail(`KSampler (56) sampler_name must be "${spec.wan_quality.sampler_name}"`);
    }
    if (typeof ksampler.inputs?.denoise !== 'number') {
      fail('KSampler (56) denoise must be a number (overridden at runtime by wanConfig)');
    }
  }

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(workflow))
    .digest('hex')
    .slice(0, 12);

  reportAndExit(hash);
}

function reportAndExit(hash) {
  if (errors.length > 0) {
    console.error('validate-workflow: FAILED\n');
    for (const err of errors) {
      console.error(`  ✗ ${err}`);
    }
    process.exit(1);
  }

  console.log('validate-workflow: OK');
  console.log(`  workflow: ${path.relative(ROOT, WORKFLOW_PATH)}`);
  console.log(`  spec:     ${path.relative(ROOT, SPEC_PATH)}`);
  console.log(`  sha256:   ${hash} (first 12 hex chars of canonical JSON)`);
  process.exit(0);
}

main();
