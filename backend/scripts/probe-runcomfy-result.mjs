#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const requestId = process.argv[2] || '029698b0-1d8d-44f4-8480-9a1aa56d5b11';

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const endpoint = env.RUNCOMFY_ENDPOINT || '';
const key = env.RUNCOMFY_API_KEY || '';
const deployMatch = endpoint.match(/deployments\/([^/]+)/);
const deployId = deployMatch?.[1] || '3183e665-5b12-467e-bfcf-b0d1fa84351f';
const url = `https://api.runcomfy.net/prod/v2/deployments/${deployId}/requests/${requestId}/result`;

const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
const text = await res.text();
const parsed = JSON.parse(text);

const summary = {
  httpStatus: res.status,
  deployId,
  requestId,
  status: parsed.status,
  error: parsed.error,
  outputKeys: parsed.outputs ? Object.keys(parsed.outputs) : [],
  outputs: parsed.outputs,
};

const outPath = path.join(__dirname, '..', 'output', '_debug_runcomfy_result.json');
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log('Wrote', outPath);
console.log('status:', parsed.status, 'nodes:', summary.outputKeys.join(', ') || '(none)');

for (const [nid, out] of Object.entries(parsed.outputs || {})) {
  for (const bucket of ['videos', 'images', 'gifs']) {
    for (const item of out[bucket] || []) {
      if (!item?.url) continue;
      const m = await fetch(item.url);
      const buf = Buffer.from(await m.arrayBuffer());
      console.log(
        `node ${nid} ${bucket} ${item.filename || 'no-name'} → HTTP ${m.status}, ${buf.length} bytes, magic ${buf.slice(0, 4).toString('hex')}`,
      );
    }
  }
}
