import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import {
  createAsset,
  updateAsset,
  listAssets,
  buildAssetRefId,
  assetNamespace,
} from '../db/episodeModels.js';

let testDir;

beforeEach(() => {
  ({ dir: testDir } = createTestDatabase());
});

afterEach(() => {
  destroyTestDatabase(testDir);
});

describe('@ID compiler — ref_id', () => {
  test('namespace wyprowadzany z type (bez kolumny kind)', () => {
    expect(assetNamespace('character')).toBe('char');
    expect(assetNamespace('location')).toBe('loc');
    expect(assetNamespace('prop')).toBe('prop');
    expect(assetNamespace('detail')).toBe('detail');
  });

  test('buildAssetRefId: stabilny slug type+name, przechowywany BEZ @', () => {
    expect(buildAssetRefId('character', 'Kebabkiller')).toBe('char_kebabkiller');
    expect(buildAssetRefId('location', 'Piec_Brick')).toBe('loc_piec_brick');
    expect(buildAssetRefId('character', 'Kebabkiller')).not.toContain('@');
  });

  test('createAsset nadaje ref_id', () => {
    const asset = createAsset({ type: 'character', name: 'Bohater', descriptionPl: 'x' });
    expect(asset.ref_id).toBe('char_bohater');
  });

  test('ref_id jest niemutowalny — zmiana nazwy go nie zmienia', () => {
    const asset = createAsset({ type: 'character', name: 'Stara Nazwa', descriptionPl: 'x' });
    const originalRefId = asset.ref_id;
    const updated = updateAsset(asset.id, { name: 'Nowa Nazwa' });
    expect(updated.name).toBe('Nowa Nazwa');
    expect(updated.ref_id).toBe(originalRefId);
  });

  test('seed (czysta karta) — assety mają ref_id', () => {
    const assets = listAssets();
    expect(assets.length).toBeGreaterThan(0);
    for (const a of assets) {
      expect(a.ref_id).toBeTruthy();
      expect(a.ref_id).toMatch(/^(char|loc|prop|detail)_/);
    }
  });
});
