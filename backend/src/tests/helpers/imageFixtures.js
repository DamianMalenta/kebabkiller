import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

export async function createUploadFixtures() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kebabkiller-test-uploads-'));
  const characterPath = path.join(dir, 'character.png');
  const backgroundPath = path.join(dir, 'background.png');

  await sharp({
    create: {
      width: 120,
      height: 200,
      channels: 3,
      background: { r: 210, g: 90, b: 50 },
    },
  })
    .png()
    .toFile(characterPath);

  await sharp({
    create: {
      width: 720,
      height: 1280,
      channels: 3,
      background: { r: 50, g: 90, b: 180 },
    },
  })
    .png()
    .toFile(backgroundPath);

  return {
    dir,
    characterPath,
    backgroundPath,
    characterRef: `/uploads/${path.basename(characterPath)}`,
    backgroundRef: `/uploads/${path.basename(backgroundPath)}`,
  };
}

export function destroyUploadFixtures(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
