import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  buildRunComfyWorkflow,
  createRunComfyEngine,
  isRunComfyCancelledStatus,
  isRunComfySuccessStatus,
  normalizeRunComfyStatus,
  pickRunComfyMedia,
  runComfyPollProgressPercent,
  WAN_QUALITY,
  WEBM_OUTPUT_NODE_ID,
  WEBP_OUTPUT_NODE_ID,
} from '../video/runComfyEngine.js';
import { mockRunComfyFetch } from './helpers/runComfyFetchMock.js';

const RUNCOMFY_CONFIG = {
  RUNCOMFY_ENDPOINT: 'https://mock.api.runcomfy.com/prod/v2/deployments/mock-deploy/inference',
  RUNCOMFY_API_KEY: 'mock_api_key',
  UPLOADS_DIR: os.tmpdir(),
};

describe('RunComfy status helpers', () => {
  test('normalizes US/UK cancel spellings', () => {
    expect(normalizeRunComfyStatus('Canceled')).toBe('canceled');
    expect(isRunComfyCancelledStatus('canceled')).toBe(true);
    expect(isRunComfyCancelledStatus('cancelled')).toBe(true);
    expect(isRunComfyCancelledStatus('cancellation_requested')).toBe(true);
  });

  test('treats completed and succeeded as success', () => {
    expect(isRunComfySuccessStatus('completed')).toBe(true);
    expect(isRunComfySuccessStatus('succeeded')).toBe(true);
  });

  test('poll progress never exceeds honest cap during wait', () => {
    expect(runComfyPollProgressPercent('in_progress', 200, 360)).toBeLessThanOrEqual(85);
  });
});

describe('buildRunComfyWorkflow', () => {
  test('submits workflow_api_json without node 51 and with WAN_QUALITY params', () => {
    const payload = buildRunComfyWorkflow('job-1', 'user prompt', {
      positive_prompt: 'director positive',
      negative_prompt: 'director negative',
    }, {});

    expect(payload.overrides).toBeUndefined();
    expect(payload.workflow_api_json).toBeDefined();
    expect(payload.workflow_api_json[WEBP_OUTPUT_NODE_ID]).toBeUndefined();
    expect(payload.workflow_api_json[WEBM_OUTPUT_NODE_ID]?.class_type).toBe('SaveWEBM');
    expect(payload.workflow_api_json['55'].inputs.text).toBe('director positive');
    expect(payload.workflow_api_json['53'].inputs.text).toBe('director negative');
    expect(payload.workflow_api_json['54'].inputs.width).toBe(WAN_QUALITY.width);
    expect(payload.workflow_api_json['54'].inputs.height).toBe(WAN_QUALITY.height);
    expect(payload.workflow_api_json['54'].inputs.length).toBe(WAN_QUALITY.length);
    expect(payload.workflow_api_json['56'].inputs.steps).toBe(WAN_QUALITY.steps);
    expect(typeof payload.workflow_api_json['56'].inputs.seed).toBe('number');
  });

  test('injects base64 start frame into node 59', () => {
    const payload = buildRunComfyWorkflow('job-2', 'prompt', {}, {
      startFrame: { type: 'base64', data: 'data:image/png;base64,abc' },
    });
    expect(payload.workflow_api_json['59'].inputs.image).toBe('data:image/png;base64,abc');
  });

  test('template does not ship node 51 WEBP saver', () => {
    const payload = buildRunComfyWorkflow('job-3', 'prompt', {}, {});
    expect(Object.keys(payload.workflow_api_json)).not.toContain(WEBP_OUTPUT_NODE_ID);
  });
});

describe('pickRunComfyMedia', () => {
  test('prefers node 52 WEBM when both node 52 and node 51 are present', () => {
    const media = pickRunComfyMedia({
      [WEBP_OUTPUT_NODE_ID]: { images: [{ url: 'https://x/out.webp', filename: '1199.webp' }] },
      [WEBM_OUTPUT_NODE_ID]: { videos: [{ url: 'https://x/out.webm', filename: 'ComfyUI.webm' }] },
    });
    expect(media.nodeId).toBe(WEBM_OUTPUT_NODE_ID);
    expect(media.kind).toBe('video');
  });

  test('falls back to node 51 WEBP when node 52 is missing', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const media = pickRunComfyMedia({
      [WEBP_OUTPUT_NODE_ID]: { images: [{ url: 'https://x/out.webp', filename: '1199.webp' }] },
    });
    expect(media.nodeId).toBe(WEBP_OUTPUT_NODE_ID);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('returns null when outputs are empty', () => {
    expect(pickRunComfyMedia({})).toBeNull();
  });
});

describe('createRunComfyEngine.render', () => {
  let outputDir;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kebabkiller-test-output-'));
    jest.useFakeTimers();
    global.fetch = mockRunComfyFetch(jest, 'webm');
  });

  afterEach(() => {
    jest.useRealTimers();
    if (outputDir && fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  async function renderWithTimers(engine, params) {
    const renderPromise = engine.render(params);
    await jest.runAllTimersAsync();
    return renderPromise;
  }

  test('writes WEBM output and metadata after mocked RunComfy flow', async () => {
    const engine = createRunComfyEngine(outputDir, RUNCOMFY_CONFIG);
    const onProgress = jest.fn();

    const result = await renderWithTimers(engine, {
      jobId: 'job-webm',
      userPrompt: 'test prompt',
      directorJson: { positive_prompt: 'director prompt' },
      renderStrategy: 'native_i2v',
      onProgress,
    });

    expect(result.engine).toBe('runcomfy');
    expect(result.renderStrategy).toBe('native_i2v');
    expect(result.outputPath.endsWith('.webm')).toBe(true);
    expect(fs.existsSync(result.outputPath)).toBe(true);

    const metaPath = result.outputPath.replace(/\.webm$/, '.meta.json');
    expect(fs.existsSync(metaPath)).toBe(true);

    const inferenceCall = global.fetch.mock.calls.find(([url]) => String(url).includes('/inference'));
    expect(inferenceCall).toBeDefined();
    expect(inferenceCall[1].headers.Authorization).toBe('Bearer mock_api_key');

    const submitBody = JSON.parse(inferenceCall[1].body);
    expect(submitBody.workflow_api_json).toBeDefined();
    expect(submitBody.workflow_api_json[WEBP_OUTPUT_NODE_ID]).toBeUndefined();
    expect(submitBody.workflow_api_json[WEBM_OUTPUT_NODE_ID]).toBeDefined();
    expect(submitBody.overrides).toBeUndefined();
    expect(onProgress).toHaveBeenCalled();
  });

  test('stops polling when RunComfy returns canceled', async () => {
    jest.useRealTimers();
    global.fetch.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/inference')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            request_id: 'mock_canceled',
            status_url: 'https://mock.api.runcomfy.com/status/mock_canceled',
            result_url: 'https://mock.api.runcomfy.com/result/mock_canceled',
          })),
        });
      }
      if (urlStr.includes('/status/')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ status: 'canceled' })),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('not found') });
    });

    const engine = createRunComfyEngine(outputDir, RUNCOMFY_CONFIG);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(engine.render({
      jobId: 'test_canceled',
      userPrompt: 'test',
      directorJson: { positive_prompt: 'test' },
      renderStrategy: 'native_i2v',
      onProgress: jest.fn(),
    })).rejects.toThrow(/cancelled/i);

    errorSpy.mockRestore();
  });

  test('falls back to WEBP when RunComfy returns only node 51', async () => {
    global.fetch = mockRunComfyFetch(jest, 'webp');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const engine = createRunComfyEngine(outputDir, RUNCOMFY_CONFIG);

    const result = await renderWithTimers(engine, {
      jobId: 'job-webp',
      userPrompt: 'test',
      directorJson: { positive_prompt: 'test' },
      renderStrategy: 'native_i2v',
      onProgress: jest.fn(),
    });

    expect(result.outputPath.endsWith('.webp')).toBe(true);
    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('throws when RunComfy submit returns HTTP 500', async () => {
    jest.useRealTimers();
    global.fetch = mockRunComfyFetch(jest, 'failSubmit');
    const engine = createRunComfyEngine(outputDir, RUNCOMFY_CONFIG);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(engine.render({
      jobId: 'job-fail',
      userPrompt: 'test',
      directorJson: {},
      renderStrategy: 'native_i2v',
      onProgress: jest.fn(),
    })).rejects.toThrow('RunComfy Submit API returned status: 500');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
