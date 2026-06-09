import fs from 'node:fs';
import path from 'node:path';

export function ensureOutputDir(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

export function resolveOutputPath(outputDir, jobId, ext = '.mp4') {
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  return path.join(outputDir, `${jobId}${safeExt}`);
}
