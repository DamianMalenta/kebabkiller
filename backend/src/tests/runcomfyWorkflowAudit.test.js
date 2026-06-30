import { describe, test, expect } from '@jest/globals';
import {
  auditBuiltPayload,
  auditWorkflowTemplate,
  EXPECTED_PAYLOAD_NODE_IDS,
  loadWorkflowTemplate,
} from '../video/runcomfyWorkflowAudit.js';
import { buildRunComfyWorkflow, WEBM_OUTPUT_NODE_ID } from '../video/runComfyEngine.js';
import { resolveWanRenderParams } from '../video/wanConfig.js';

describe('runcomfy workflow audit', () => {
  test('template satisfies required nodes and class types', () => {
    const template = loadWorkflowTemplate();
    const findings = auditWorkflowTemplate(template);
    const fails = findings.filter((f) => f.level === 'FAIL');
    expect(fails).toEqual([]);
    expect(template[WEBM_OUTPUT_NODE_ID].class_type).toBe('SaveWEBM');
  });

  test('built payload has 13 nodes without WEBP and correct WAN_LENGTH', () => {
    const payload = buildRunComfyWorkflow(
      'audit-test',
      'prompt',
      { positive_prompt: 'pos', negative_prompt: 'neg' },
      { startFrame: { type: 'base64', data: 'data:image/jpeg;base64,abc' } },
    );

    const findings = auditBuiltPayload(payload);
    const fails = findings.filter((f) => f.level === 'FAIL');
    expect(fails).toEqual([]);
    expect(Object.keys(payload.workflow_api_json)).toHaveLength(EXPECTED_PAYLOAD_NODE_IDS.length);
    expect(payload.workflow_api_json['54'].inputs.length).toBe(resolveWanRenderParams().length);
    expect(payload.workflow_api_json['54'].inputs.width).toBe(resolveWanRenderParams().width);
  });
});
