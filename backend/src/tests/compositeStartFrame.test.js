import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import path from 'node:path';
import sharp from 'sharp';
import {
  buildStartFrameAsset,
  resolveUploadPath,
  resolveCompositeConfig,
  DEFAULT_COMPOSITE,
} from '../video/compositeStartFrame.js';
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

  describe('kaskada composite (Faza C): scene ?? asset ?? hardcoded', () => {
    test('resolveCompositeConfig — scena wygrywa, potem asset, potem fallback', () => {
      const scene = { scale: 0.3, position: { x: 0.2, y: 0.5 } };
      const asset = { scale: 0.8, position: { x: 0.9, y: 0.9 } };

      // scena > asset
      expect(resolveCompositeConfig(scene, asset).scale).toBe(0.3);
      expect(resolveCompositeConfig(scene, asset).position.x).toBe(0.2);
      // brak sceny → asset
      expect(resolveCompositeConfig(null, asset).scale).toBe(0.8);
      // brak obu → hardcoded fallback
      const fb = resolveCompositeConfig(null, null);
      expect(fb.scale).toBe(DEFAULT_COMPOSITE.scale);
      expect(fb.position).toEqual(DEFAULT_COMPOSITE.position);
      expect(fb.source).toBe('compose');
    });

    test('brakujące pola override dopełnia DEFAULT_COMPOSITE', () => {
      const cfg = resolveCompositeConfig({ scale: 0.4 }, null);
      expect(cfg.scale).toBe(0.4);
      expect(cfg.position).toEqual(DEFAULT_COMPOSITE.position);
      expect(cfg.heightScale).toBe(DEFAULT_COMPOSITE.heightScale);
    });

    test('composite override (scale/pozycja) zmienia złożoną klatkę vs domyślna', async () => {
      const base = await buildStartFrameAsset({
        characterRef: fixtures.characterRef,
        backgroundRef: fixtures.backgroundRef,
        uploadsDir: fixtures.dir,
      });
      const steered = await buildStartFrameAsset({
        characterRef: fixtures.characterRef,
        backgroundRef: fixtures.backgroundRef,
        uploadsDir: fixtures.dir,
        composite: { scale: 0.25, position: { x: 0.15, y: 0.4 } },
      });

      expect(steered?.source).toBe('composite');
      // Override realnie wpływa na piksele → inna klatka niż domyślna.
      expect(steered.data).not.toBe(base.data);

      const meta = await sharp(Buffer.from(steered.data.split(',')[1], 'base64')).metadata();
      expect(meta.width).toBe(480);
      expect(meta.height).toBe(832);
    });
  });
});
