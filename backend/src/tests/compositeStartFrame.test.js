import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStartFrameAsset, resolveUploadPath } from '../video/compositeStartFrame.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../uploads');

describe('compositeStartFrame', () => {
  test('resolveUploadPath maps /uploads/ URLs to disk', () => {
    const resolved = resolveUploadPath('/uploads/example.jpg', uploadsDir);
    expect(resolved).toBe(path.join(uploadsDir, 'example.jpg'));
  });

  test('buildStartFrameAsset returns composite when both refs exist on disk', async () => {
    const files = fs.readdirSync(uploadsDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (files.length < 2) {
      console.warn('Skipping composite test — need 2+ images in uploads/');
      return;
    }

    const result = await buildStartFrameAsset({
      characterRef: `/uploads/${files[0]}`,
      backgroundRef: `/uploads/${files[1]}`,
      uploadsDir,
      width: 480,
      height: 832,
    });

    expect(result).not.toBeNull();
    expect(result.source).toBe('composite');
    expect(result.data).toMatch(/^data:image\/jpeg;base64,/);
  });
});
