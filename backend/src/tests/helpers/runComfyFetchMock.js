import { WEBP_OUTPUT_NODE_ID, WEBM_OUTPUT_NODE_ID } from '../../video/runComfyEngine.js';

const BASE = 'https://mock.api.runcomfy.com';

function mockWebmBuffer() {
  const buf = Buffer.alloc(64, 0);
  buf[0] = 0x1a;
  buf[1] = 0x45;
  buf[2] = 0xdf;
  buf[3] = 0xa3;
  return buf;
}

export function mockRunComfyFetch(jest, mode = 'webm') {
  return jest.fn((url, init) => {
    const urlStr = String(url);

    if (mode === 'failSubmit') {
      return Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve(JSON.stringify({ error: 'Internal Server Error' })),
      });
    }

    if (urlStr.includes('/inference')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          request_id: 'mock_request_123',
          status_url: `${BASE}/status/mock_request_123`,
          result_url: `${BASE}/result/mock_request_123`,
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
      const outputs = mode === 'emptyWebm'
        ? {
            [WEBM_OUTPUT_NODE_ID]: {
              images: [{ url: `${BASE}/output.webm`, filename: 'ComfyUI_00001_.webm' }],
            },
          }
        : mode === 'webp'
        ? {
            [WEBP_OUTPUT_NODE_ID]: {
              images: [{ url: `${BASE}/output.webp`, filename: '1199.webp' }],
            },
          }
        : {
            [WEBM_OUTPUT_NODE_ID]: {
              videos: [{ url: `${BASE}/output.webm`, filename: 'ComfyUI.webm' }],
            },
            [WEBP_OUTPUT_NODE_ID]: {
              images: [{ url: `${BASE}/output.webp`, filename: '1199.webp' }],
            },
          };

      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ status: 'succeeded', outputs })),
      });
    }

    if (urlStr.includes('output.webm')) {
      const body = mode === 'emptyWebm' ? Buffer.alloc(0) : mockWebmBuffer();
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'video/webm' },
        arrayBuffer: () => Promise.resolve(body),
      });
    }

    if (urlStr.includes('output.webp')) {
      const buf = Buffer.alloc(64, 0);
      buf.write('RIFF', 0);
      buf.write('WEBP', 8);
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'image/webp' },
        arrayBuffer: () => Promise.resolve(buf),
      });
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      text: () => Promise.resolve('not found'),
    });
  });
}
