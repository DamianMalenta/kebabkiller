import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import {
  buildRunComfyWorkflow,
  createRunComfyEngine,
  pickRunComfyMedia,
  WAN_QUALITY,
  WEBM_OUTPUT_NODE_ID,
  WEBP_OUTPUT_NODE_ID,
} from '../video/runComfyEngine.js';

// Mock the network fetch call
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    text: () => Promise.resolve(JSON.stringify({
      request_id: 'mock_request_123',
      status_url: 'https://mock.api.runcomfy.com/status/mock_request_123',
      result_url: 'https://mock.api.runcomfy.com/result/mock_request_123',
    })),
  })
);

// We won't mock `fs` or `path` to avoid ES Module read-only errors. 
// We will test using real files located in the project's folder.

describe('buildRunComfyWorkflow', () => {
  test('sends workflow_api_json without node 51 and with quality-first params', () => {
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

describe('runComfyEngine', () => {
  let runComfy;
  const mockOutputDir = './mock_output_temp_dir'; // local directory
  const mockConfig = {
    RUNCOMFY_ENDPOINT: 'https://mock.api.runcomfy.com/prod/v2/deployments/mock-deploy/inference',
    RUNCOMFY_API_KEY: 'mock_api_key',
  };

  beforeAll(() => {
    runComfy = createRunComfyEngine(mockOutputDir, mockConfig);
  });

  beforeEach(() => {
    global.fetch.mockReset();
    global.fetch.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/inference')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            request_id: 'mock_request_123',
            status_url: 'https://mock.api.runcomfy.com/status/mock_request_123',
            result_url: 'https://mock.api.runcomfy.com/result/mock_request_123',
          })),
        });
      }
      if (urlStr.includes('/status/')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ status: 'completed' })),
        });
      }
      if (urlStr.includes('/result/')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            status: 'succeeded',
            outputs: {
              '52': { videos: [{ url: 'https://mock.api.runcomfy.com/output.webm', filename: 'ComfyUI.webm' }] },
              '51': { images: [{ url: 'https://mock.api.runcomfy.com/output.webp', filename: '1199.webp' }] },
            },
          })),
        });
      }
      if (urlStr.includes('output.webm')) {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'video/webm' },
          arrayBuffer: () => Promise.resolve(Buffer.from('mock-webm-bytes')),
        });
      }
      if (urlStr.includes('output.webp') || urlStr.includes('video.mp4')) {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from('mock-mp4-bytes')),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('not found') });
    });
  });

  test('should process input correctly and return a mocked video response without throwing', async () => {
    const jobId = 'test_job_id';
    const userPrompt = 'a test prompt';
    const directorJson = { positive_prompt: 'a director prompt' }; 
    const renderStrategy = 'native_i2v';
    const onProgress = jest.fn();

    const result = await runComfy.render({ jobId, userPrompt, directorJson, renderStrategy, onProgress });

    const inferenceCall = global.fetch.mock.calls.find(([url]) => String(url).includes('/inference'));
    expect(inferenceCall).toBeDefined();
    const submitBody = JSON.parse(inferenceCall[1].body);
    expect(submitBody.workflow_api_json).toBeDefined();
    expect(submitBody.workflow_api_json[WEBP_OUTPUT_NODE_ID]).toBeUndefined();
    expect(submitBody.workflow_api_json[WEBM_OUTPUT_NODE_ID]).toBeDefined();
    expect(submitBody.overrides).toBeUndefined();
    expect(result.renderStrategy).toEqual('native_i2v');
    expect(result.engine).toEqual('runcomfy');
    expect(result.outputPath.endsWith('.webm')).toBe(true);
  }, 15000);


  test('should handle RunComfy API status 500 error', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve(JSON.stringify({ error: 'Internal Server Error' })),
      })
    );

    const jobId = 'test_job_id_error';
    const userPrompt = 'a test prompt';
    const directorJson = {};
    const renderStrategy = 'native_i2v';
    const onProgress = jest.fn();

    await expect(runComfy.render({ jobId, userPrompt, directorJson, renderStrategy, onProgress }))
      .rejects.toThrow('RunComfy Submit API returned status: 500');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('falls back to WEBP when result has only node 51', async () => {
    global.fetch.mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/inference')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            request_id: 'mock_webp_only',
            status_url: 'https://mock.api.runcomfy.com/status/mock_webp_only',
            result_url: 'https://mock.api.runcomfy.com/result/mock_webp_only',
          })),
        });
      }
      if (urlStr.includes('/status/')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({ status: 'completed' })),
        });
      }
      if (urlStr.includes('/result/')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            status: 'succeeded',
            outputs: {
              [WEBP_OUTPUT_NODE_ID]: { images: [{ url: 'https://mock.api.runcomfy.com/output.webp', filename: '1199.webp' }] },
            },
          })),
        });
      }
      if (urlStr.includes('output.webp')) {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'image/webp' },
          arrayBuffer: () => Promise.resolve(Buffer.from('mock-webp-bytes')),
        });
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('not found') });
    });

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runComfy.render({
      jobId: 'test_webp_fallback',
      userPrompt: 'test',
      directorJson: { positive_prompt: 'test' },
      renderStrategy: 'native_i2v',
      onProgress: jest.fn(),
    });

    expect(result.outputPath.endsWith('.webp')).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  }, 15000);
});
