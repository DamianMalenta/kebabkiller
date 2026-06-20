import { describe, test, expect } from '@jest/globals';
import { buildDeterministicAssetMetadata } from '../ai/directorDesk/assetMetadata.js';

describe('buildDeterministicAssetMetadata', () => {
  test('returns full metadata for a character asset', () => {
    const result = buildDeterministicAssetMetadata({
      asset: { type: 'character', name: 'Kebabkiller', description_pl: 'Główny bohater' },
      label: 'Postać główna',
      filename: 'kebab.png',
    });

    expect(result.description).toContain('Postać');
    expect(result.description).toContain('Kebabkiller');
    expect(result.description).toContain('Postać główna');
    expect(result.description).toContain('Główny bohater');
    expect(result.asset_type).toBe('character');
    expect(result.source).toBe('deterministic');
    expect(result.analyzed_at).toBeDefined();
  });

  test('returns metadata for a location asset', () => {
    const result = buildDeterministicAssetMetadata({
      asset: { type: 'location', name: 'Budka z kebabem' },
      label: null,
      filename: 'budka.jpg',
    });

    expect(result.description).toContain('Lokacja / tło');
    expect(result.description).toContain('Budka z kebabem');
    expect(result.asset_type).toBe('location');
  });

  test('returns metadata for a prop asset', () => {
    const result = buildDeterministicAssetMetadata({
      asset: { type: 'prop', name: 'Nóż', description_pl: 'Wielki nóż do kebaba' },
      label: null,
      filename: 'noz.png',
    });

    expect(result.description).toContain('Rekwizyt');
    expect(result.description).toContain('Nóż');
    expect(result.asset_type).toBe('prop');
  });

  test('returns metadata for a detail asset', () => {
    const result = buildDeterministicAssetMetadata({
      asset: { type: 'detail', name: 'Sos' },
      label: 'Detal sceny',
      filename: 'sos.png',
    });

    expect(result.description).toContain('Detal');
    expect(result.asset_type).toBe('detail');
  });

  test('falls back to "Asset" for unknown type', () => {
    const result = buildDeterministicAssetMetadata({
      asset: { type: 'unknown_type', name: 'Coś' },
      label: null,
      filename: 'cos.png',
    });

    expect(result.description).toContain('Asset');
    expect(result.asset_type).toBe('unknown_type');
  });

  test('falls back to "Asset" when asset is null (typeHint fallback)', () => {
    const result = buildDeterministicAssetMetadata({
      asset: null,
      label: null,
      filename: 'fallback.png',
    });

    // When asset is null, typeHints[undefined] is undefined, so fallback is 'Asset'
    expect(result.description).toBe('Asset');
    expect(result.asset_type).toBe('unknown');
  });

  test('uses "Asset" when asset and filename are both null', () => {
    const result = buildDeterministicAssetMetadata({
      asset: null,
      label: null,
      filename: null,
    });

    // 'Asset' is the fallback for unknown type, and it's truthy so filename/default not used
    expect(result.description).toBe('Asset');
    expect(result.asset_type).toBe('unknown');
  });

  test('truncates description to 280 characters', () => {
    const longName = 'A'.repeat(300);
    const result = buildDeterministicAssetMetadata({
      asset: { type: 'character', name: longName },
      label: null,
      filename: 'x.png',
    });

    expect(result.description.length).toBeLessThanOrEqual(280);
  });

  test('filters out null/undefined parts', () => {
    const result = buildDeterministicAssetMetadata({
      asset: { type: 'character', name: undefined, description_pl: undefined },
      label: undefined,
      filename: 'test.png',
    });

    // Should just have "Postać" from typeHints since others are filtered
    expect(result.description).toBe('Postać');
  });

  test('analyzed_at is a valid ISO string', () => {
    const result = buildDeterministicAssetMetadata({
      asset: { type: 'character', name: 'Test' },
      label: null,
      filename: 'test.png',
    });

    expect(() => new Date(result.analyzed_at)).not.toThrow();
    expect(new Date(result.analyzed_at).toISOString()).toBe(result.analyzed_at);
  });
});
