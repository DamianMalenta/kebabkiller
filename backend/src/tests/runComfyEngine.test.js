import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  buildRunComfyWorkflow,
  createRunComfyEngine,
  isRunComfyCancelledStatus,
  isRunComfySuccessStatus,
  normalizeRunComfyStatus,
  pickRunComfyMedia,
  runComfyPollProgressPercent,
  validateMediaBuffer,
  WEBM_OUTPUT_NODE_ID,
  WEBP_OUTPUT_NODE_ID,
} from '../video/runComfyEngine.js';
import { deterministicSeed, resolveWanRenderParams } from '../video/wanConfig.js';
import { mockRunComfyFetch } from './helpers/runComfyFetchMock.js';

const RUNCOMFY_CONFIG = {
  RUNCOMFY_ENDPOINT: 'https://mock.api.runcomfy.com/prod/v2/deployments/mock-deploy/inference',
  RUNCOMFY_API_KEY: 'mock_api_key',
  UPLOADS_DIR: os.tmpdir(),
};

const TEST_START_FRAME = {
  startFrame: { type: 'base64', data: 'data:image/png;base64,abc' },
};

async function writeTestStartFrame(uploadsDir) {
  const framePath = path.join(uploadsDir, 'runcomfy-test-start.jpg');
  await sharp({
    create: { width: 480, height: 832, channels: 3, background: { r: 20, g: 30, b: 40 } },
  }).jpeg().toFile(framePath);
  return framePath;
}

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
    const wan = resolveWanRenderParams();
    const payload = buildRunComfyWorkflow('job-1', 'user prompt', {
      positive_prompt: 'director positive',
      negative_prompt: 'director negative',
    }, TEST_START_FRAME);

    expect(payload.overrides).toBeUndefined();
    expect(payload.workflow_api_json).toBeDefined();
    expect(payload.workflow_api_json[WEBP_OUTPUT_NODE_ID]).toBeUndefined();
    expect(payload.workflow_api_json[WEBM_OUTPUT_NODE_ID]?.class_type).toBe('SaveWEBM');
    expect(payload.workflow_api_json['55'].inputs.text).toBe('director positive');
    expect(payload.workflow_api_json['53'].inputs.text).toBe('director negative');
    expect(payload.workflow_api_json['54'].inputs.width).toBe(wan.width);
    expect(payload.workflow_api_json['54'].inputs.height).toBe(wan.height);
    expect(payload.workflow_api_json['54'].inputs.length).toBe(wan.length);
    expect(payload.workflow_api_json['56'].inputs.steps).toBe(wan.steps);
    expect(payload.workflow_api_json['56'].inputs.denoise).toBe(wan.denoise);
    expect(typeof payload.workflow_api_json['56'].inputs.seed).toBe('number');
  });

  test('applies I2V_PRODUCTION denoise and per-scene length from director json', () => {
    const payload = buildRunComfyWorkflow('job-prod', 'prompt', {
      i2v_profile: 'I2V_PRODUCTION',
      duration_sec: 4,
      positive_prompt: 'test',
      negative_prompt: 'neg',
    }, TEST_START_FRAME);

    expect(payload.workflow_api_json['54'].inputs.length).toBe(96);
    expect(payload.workflow_api_json['56'].inputs.denoise).toBe(0.85);
  });

  test('injects base64 start frame into node 59', () => {
    const payload = buildRunComfyWorkflow('job-2', 'prompt', {}, {
      startFrame: { type: 'base64', data: 'data:image/png;base64,abc' },
    });
    expect(payload.workflow_api_json['59'].inputs.image).toBe('data:image/png;base64,abc');
  });

  test('template does not ship node 51 WEBP saver', () => {
    const payload = buildRunComfyWorkflow('job-3', 'prompt', {}, TEST_START_FRAME);
    expect(Object.keys(payload.workflow_api_json)).not.toContain(WEBP_OUTPUT_NODE_ID);
  });

  test('uzywa seeda z directorJson (determinizm z planu)', () => {
    const payload = buildRunComfyWorkflow('job-seed', 'prompt', {
      positive_prompt: 'p',
      negative_prompt: 'n',
      seed: 424242,
    }, TEST_START_FRAME);
    expect(payload.workflow_api_json['56'].inputs.seed).toBe(424242);
  });

  test('bez seeda — deterministyczny z promptu (brak Math.random), 2× identyczny', () => {
    const dj = { positive_prompt: 'powtarzalny prompt', negative_prompt: 'neg' };
    const a = buildRunComfyWorkflow('job-a', 'prompt', dj, TEST_START_FRAME);
    const b = buildRunComfyWorkflow('job-b', 'prompt', dj, TEST_START_FRAME);
    expect(a.workflow_api_json['56'].inputs.seed).toBe(b.workflow_api_json['56'].inputs.seed);
    expect(a.workflow_api_json['56'].inputs.seed).toBe(deterministicSeed('powtarzalny prompt|neg'));
  });
});

describe('deterministicSeed', () => {
  test('ten sam klucz → ten sam seed; różne klucze → różne seedy', () => {
    expect(deterministicSeed('plan1:scene1')).toBe(deterministicSeed('plan1:scene1'));
    expect(deterministicSeed('plan1:scene1')).not.toBe(deterministicSeed('plan1:scene2'));
  });

  test('seed jest nieujemną liczbą całkowitą w zakresie ~1e12', () => {
    const seed = deterministicSeed('plan1:scene1');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(1_000_000_000_000);
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

  test('picks node 52 WEBM listed under images (RunComfy API quirk)', () => {
    const media = pickRunComfyMedia({
      [WEBM_OUTPUT_NODE_ID]: {
        images: [{ url: 'https://x/ComfyUI_00001_.webm', filename: 'ComfyUI_00001_.webm' }],
      },
    });
    expect(media.nodeId).toBe(WEBM_OUTPUT_NODE_ID);
    expect(media.kind).toBe('video');
  });

  test('returns null when outputs are empty', () => {
    expect(pickRunComfyMedia({})).toBeNull();
  });
});

describe('validateMediaBuffer', () => {
  test('rejects empty and tiny WEBM', () => {
    expect(validateMediaBuffer(Buffer.alloc(0), '.webm').ok).toBe(false);
    expect(validateMediaBuffer(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), '.webm').ok).toBe(false);
  });

  test('accepts WEBM with EBML magic and minimum size', () => {
    const buf = Buffer.alloc(64, 0);
    buf[0] = 0x1a;
    buf[1] = 0x45;
    buf[2] = 0xdf;
    buf[3] = 0xa3;
    expect(validateMediaBuffer(buf, '.webm').ok).toBe(true);
  });
});

describe('createRunComfyEngine.render', () => {
  let outputDir;
  let uploadsDir;
  let startFramePath;

  beforeEach(async () => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kebabkiller-test-output-'));
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kebabkiller-test-uploads-'));
    startFramePath = await writeTestStartFrame(uploadsDir);
    jest.useFakeTimers();
    global.fetch = mockRunComfyFetch(jest, 'webm');
  });

  afterEach(() => {
    jest.useRealTimers();
    if (outputDir && fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    if (uploadsDir && fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
  });

  function renderDirectorJson(overrides = {}) {
    return {
      positive_prompt: 'director prompt',
      start_frame_path: startFramePath,
      ...overrides,
    };
  }

  function engineConfig() {
    return { ...RUNCOMFY_CONFIG, UPLOADS_DIR: uploadsDir };
  }

  async function renderWithTimers(engine, params) {
    const renderPromise = engine.render(params);
    await jest.runAllTimersAsync();
    return renderPromise;
  }

  test('writes WEBM output and metadata after mocked RunComfy flow', async () => {
    const engine = createRunComfyEngine(outputDir, engineConfig());
    const onProgress = jest.fn();

    const result = await renderWithTimers(engine, {
      jobId: 'job-webm',
      userPrompt: 'test prompt',
      directorJson: renderDirectorJson(),
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

    const engine = createRunComfyEngine(outputDir, engineConfig());
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(engine.render({
      jobId: 'test_canceled',
      userPrompt: 'test',
      directorJson: renderDirectorJson({ positive_prompt: 'test' }),
      renderStrategy: 'native_i2v',
      onProgress: jest.fn(),
    })).rejects.toThrow(/cancelled/i);

    errorSpy.mockRestore();
  });

  test('falls back to WEBP when RunComfy returns only node 51', async () => {
    global.fetch = mockRunComfyFetch(jest, 'webp');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const engine = createRunComfyEngine(outputDir, engineConfig());

    const result = await renderWithTimers(engine, {
      jobId: 'job-webp',
      userPrompt: 'test',
      directorJson: renderDirectorJson({ positive_prompt: 'test' }),
      renderStrategy: 'native_i2v',
      onProgress: jest.fn(),
    });

    expect(result.outputPath.endsWith('.webp')).toBe(true);
    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('rejects empty WEBM from RunComfy CDN after retries', async () => {
    jest.useRealTimers();
    process.env.RUNCOMFY_DOWNLOAD_RETRIES = '2';
    process.env.RUNCOMFY_DOWNLOAD_RETRY_MS = '1';
    global.fetch = mockRunComfyFetch(jest, 'emptyWebm');
    const engine = createRunComfyEngine(outputDir, engineConfig());
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(engine.render({
      jobId: 'job-empty-webm',
      userPrompt: 'test',
      directorJson: renderDirectorJson(),
      renderStrategy: 'native_i2v',
      onProgress: jest.fn(),
    })).rejects.toThrow(/invalid|empty|too small/i);

    delete process.env.RUNCOMFY_DOWNLOAD_RETRIES;
    delete process.env.RUNCOMFY_DOWNLOAD_RETRY_MS;
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test('throws when RunComfy submit returns HTTP 500', async () => {
    jest.useRealTimers();
    global.fetch = mockRunComfyFetch(jest, 'failSubmit');
    const engine = createRunComfyEngine(outputDir, engineConfig());
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(engine.render({
      jobId: 'job-fail',
      userPrompt: 'test',
      directorJson: renderDirectorJson(),
      renderStrategy: 'native_i2v',
      onProgress: jest.fn(),
    })).rejects.toThrow('RunComfy Submit API returned status: 500');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
