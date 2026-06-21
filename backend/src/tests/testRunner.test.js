import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { runBackendTests } from '../ai/systemAgent/testRunner.js';

// We mock spawnSync by replacing the module — but since this is ESM,
// we test the function indirectly by verifying its output format.
// The function uses spawnSync internally, so we test it with a real but
// harmless command to validate the return shape.

describe('runBackendTests', () => {
  test('returns object with ok, summary, exitCode fields', () => {
    // Run against a non-existent repo path to get a predictable failure
    const result = runBackendTests('/tmp/nonexistent-repo-' + Date.now());

    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('exitCode');
    expect(typeof result.ok).toBe('boolean');
    expect(typeof result.summary).toBe('string');
  });

  test('returns ok=false for non-existent directory', () => {
    const result = runBackendTests('/tmp/nonexistent-' + Date.now());

    expect(result.ok).toBe(false);
    expect(result.summary).toBe('failed');
  });

  test('exitCode is a number or null', () => {
    const result = runBackendTests('/tmp/nonexistent-' + Date.now());

    // exitCode can be null if the process is killed by a signal
    expect(result.exitCode === null || typeof result.exitCode === 'number').toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  test('parses Tests summary line from output when available', () => {
    // The function extracts "Tests: ..." from the output.
    // Since spawnSync is internal, we verify the regex logic separately.
    const testOutput = 'Tests:       132 passed, 132 total';
    const match = testOutput.match(/Tests:\s+(.+)/);
    expect(match).not.toBeNull();
    expect(match[1].trim()).toBe('132 passed, 132 total');
  });
});
