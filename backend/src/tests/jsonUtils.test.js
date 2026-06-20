import { describe, test, expect } from '@jest/globals';
import { parseJsonField, hydrateRow } from '../utils/json.js';

describe('parseJsonField', () => {
  test('parses valid JSON string', () => {
    expect(parseJsonField('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonField('[1,2,3]')).toEqual([1, 2, 3]);
    expect(parseJsonField('"hello"')).toBe('hello');
  });

  test('returns fallback for null/undefined/empty', () => {
    expect(parseJsonField(null)).toBeNull();
    expect(parseJsonField(undefined)).toBeNull();
    expect(parseJsonField('')).toBeNull();
    expect(parseJsonField(null, [])).toEqual([]);
    expect(parseJsonField('', {})).toEqual({});
  });

  test('returns fallback for invalid JSON', () => {
    expect(parseJsonField('not json')).toBeNull();
    expect(parseJsonField('{broken', 'default')).toBe('default');
    expect(parseJsonField('{{{')).toBeNull();
  });

  test('handles numeric and boolean JSON', () => {
    expect(parseJsonField('42')).toBe(42);
    expect(parseJsonField('true')).toBe(true);
    expect(parseJsonField('false')).toBe(false);
  });
});

describe('hydrateRow', () => {
  test('converts integer 0/1 to boolean for is_ fields', () => {
    const row = { is_active: 1, is_deleted: 0, name: 'test' };
    const result = hydrateRow(row);
    expect(result.is_active).toBe(true);
    expect(result.is_deleted).toBe(false);
    expect(result.name).toBe('test');
  });

  test('converts integer 0/1 to boolean for has_ fields', () => {
    const row = { has_access: 1, has_premium: 0 };
    const result = hydrateRow(row);
    expect(result.has_access).toBe(true);
    expect(result.has_premium).toBe(false);
  });

  test('converts integer 0/1 to boolean for _enabled fields', () => {
    const row = { notifications_enabled: 1, debug_enabled: 0 };
    const result = hydrateRow(row);
    expect(result.notifications_enabled).toBe(true);
    expect(result.debug_enabled).toBe(false);
  });

  test('converts integer 0/1 to boolean for _confirmed fields', () => {
    const row = { email_confirmed: 1, phone_confirmed: 0 };
    const result = hydrateRow(row);
    expect(result.email_confirmed).toBe(true);
    expect(result.phone_confirmed).toBe(false);
  });

  test('preserves existing boolean values', () => {
    const row = { is_active: true, is_deleted: false };
    const result = hydrateRow(row);
    expect(result.is_active).toBe(true);
    expect(result.is_deleted).toBe(false);
  });

  test('sets non-number non-boolean fields to false', () => {
    const row = { is_weird: 'yes', has_strange: null };
    const result = hydrateRow(row);
    expect(result.is_weird).toBe(false);
    expect(result.has_strange).toBe(false);
  });

  test('returns null/undefined as-is', () => {
    expect(hydrateRow(null)).toBeNull();
    expect(hydrateRow(undefined)).toBeUndefined();
  });

  test('does not mutate original row', () => {
    const row = { is_active: 1, name: 'original' };
    const result = hydrateRow(row);
    expect(row.is_active).toBe(1);
    expect(result.is_active).toBe(true);
  });

  test('handles empty object', () => {
    const result = hydrateRow({});
    expect(result).toEqual({});
  });

  test('does not affect regular string/number fields', () => {
    const row = { id: 123, title: 'hello', count: 42 };
    const result = hydrateRow(row);
    expect(result).toEqual({ id: 123, title: 'hello', count: 42 });
  });
});
