import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'node:path';
import sharp from 'sharp';
import { buildStartFrameAsset, resolveUploadPath } from '../video/compositeStartFrame.js';
import { createUploadFixtures, destroyUploadFixtures } from './helpers/imageFixtures.js';

describe('compositeStartFrame', () => {
  let fixtures;

  beforeAll(async () => {
    fixtures = await createUploadFixtures();
  });

  afterAll(() => {
    destroyUploadFixtures(fixtures?.dir);
  });

  test('resolveUploadPath maps /uploads/ URLs to disk', () => {
    const resolved = resolveUploadPath('/uploads/character.png', fixtures.dir);
    expect(resolved).toBe(path.join(fixtures.dir, 'character.png'));
  });

  test('resolveUploadPath returns absolute path when file exists', () => {
    expect(resolveUploadPath(fixtures.characterPath, fixtures.dir)).toBe(fixtures.characterPath);
  });

  test('returns null when character and background refs are missing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await buildStartFrameAsset({
      characterRef: null,
      backgroundRef: null,
      uploadsDir: fixtures.dir,
    });
    expect(result).toBeNull();
    warn.mockRestore();
  });

  test('returns character-only frame when background is missing', async () => {
    const result = await buildStartFrameAsset({
      characterRef: fixtures.characterRef,
      backgroundRef: '/uploads/missing-bg.png',
      uploadsDir: fixtures.dir,
    });

    expect(result).toEqual({
      type: 'base64',
      source: 'character',
      data: expect.stringMatching(/^data:image\/png;base64,/),
    });
  });

  test('returns resized background when character is missing', async () => {
    const result = await buildStartFrameAsset({
      characterRef: '/uploads/missing-char.png',
      backgroundRef: fixtures.backgroundRef,
      uploadsDir: fixtures.dir,
      width: 480,
      height: 832,
    });

    expect(result?.source).toBe('background');
    expect(result?.data).toMatch(/^data:image\/jpeg;base64,/);

    const buffer = Buffer.from(result.data.split(',')[1], 'base64');
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(480);
    expect(meta.height).toBe(832);
  });

  test('composites character on background at target 9:16 size', async () => {
    const result = await buildStartFrameAsset({
      characterRef: fixtures.characterRef,
      backgroundRef: fixtures.backgroundRef,
      uploadsDir: fixtures.dir,
      width: 480,
      height: 832,
    });

    expect(result?.source).toBe('composite');
    expect(result?.data).toMatch(/^data:image\/jpeg;base64,/);

    const buffer = Buffer.from(result.data.split(',')[1], 'base64');
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(480);
    expect(meta.height).toBe(832);
  });
});
