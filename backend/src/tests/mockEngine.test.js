import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMockEngine, createVideoEngine } from '../video/mockEngine.js';

describe('createMockEngine', () => {
  let outputDir;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-mock-engine-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  test('returns engine with name "mock"', () => {
    const engine = createMockEngine(outputDir);
    expect(engine.name).toBe('mock');
    expect(typeof engine.render).toBe('function');
  });

  test('render produces a video file (real webm via ffmpeg or text placeholder)', async () => {
    const engine = createMockEngine(outputDir);
    const progress = [];

    const result = await engine.render({
      jobId: 'job-123',
      userPrompt: 'Kebabkiller walks',
      directorJson: {},
      onProgress: (p) => progress.push(p),
    });

    expect(result.outputPath).toBeTruthy();
    expect(result.engine).toBe('mock');
    expect(fs.existsSync(result.outputPath)).toBe(true);
    expect(fs.statSync(result.outputPath).size).toBeGreaterThan(0);

    const buf = fs.readFileSync(result.outputPath);
    const isWebm = buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    if (!isWebm) {
      const content = buf.toString('utf8');
      expect(content).toContain('MOCK_VIDEO_PLACEHOLDER');
      expect(content).toContain('job=job-123');
    }
  });

  test('render creates metadata file alongside video', async () => {
    const engine = createMockEngine(outputDir);

    const result = await engine.render({
      jobId: 'job-meta',
      userPrompt: 'Test meta',
      directorJson: {},
      onProgress: () => {},
    });

    const metaPath = result.outputPath.replace(/\.[^.]+$/, '.meta.json');
    expect(fs.existsSync(metaPath)).toBe(true);

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    expect(meta.jobId).toBe('job-meta');
    expect(meta.userPrompt).toBe('Test meta');
    expect(meta.engine).toBe('mock');
    expect(meta.format).toBe('9:16');
  });

  test('render calls onProgress multiple times', async () => {
    const engine = createMockEngine(outputDir);
    const progress = [];

    await engine.render({
      jobId: 'job-progress',
      userPrompt: 'Progress test',
      directorJson: {},
      onProgress: (p) => progress.push(p),
    });

    expect(progress.length).toBeGreaterThan(0);
    expect(progress).toContain(40);
    expect(progress).toContain(95);
  });

  test('render uses custom outputPath when provided', async () => {
    const engine = createMockEngine(outputDir);
    const customPath = path.join(outputDir, 'custom', 'output.webm');

    const result = await engine.render({
      jobId: 'job-custom-path',
      userPrompt: 'Custom path',
      directorJson: {},
      onProgress: () => {},
      outputPath: customPath,
    });

    expect(result.outputPath).toBe(customPath);
    expect(fs.existsSync(customPath)).toBe(true);
  });

  test('render returns renderStrategy from directorJson if no override', async () => {
    const engine = createMockEngine(outputDir);

    const result = await engine.render({
      jobId: 'job-strategy',
      userPrompt: 'Strategy test',
      directorJson: { render_strategy: 'custom_strategy' },
      onProgress: () => {},
    });

    expect(result.renderStrategy).toBe('custom_strategy');
  });

  test('render uses explicit renderStrategy over directorJson', async () => {
    const engine = createMockEngine(outputDir);

    const result = await engine.render({
      jobId: 'job-explicit',
      userPrompt: 'Explicit strategy',
      directorJson: { render_strategy: 'from_director' },
      renderStrategy: 'explicit_override',
      onProgress: () => {},
    });

    expect(result.renderStrategy).toBe('explicit_override');
  });

  test('render works without onProgress callback', async () => {
    const engine = createMockEngine(outputDir);

    const result = await engine.render({
      jobId: 'job-no-progress',
      userPrompt: 'No progress',
      directorJson: {},
    });

    expect(result.outputPath).toBeTruthy();
    expect(result.engine).toBe('mock');
  });
});

describe('createVideoEngine', () => {
  let outputDir;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-video-engine-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  test('returns mock engine by default', () => {
    const engine = createVideoEngine({ OUTPUT_DIR: outputDir });
    expect(engine.name).toBe('mock');
  });

  test('returns mock engine when VIDEO_ENGINE=mock', () => {
    const engine = createVideoEngine({ VIDEO_ENGINE: 'mock', OUTPUT_DIR: outputDir });
    expect(engine.name).toBe('mock');
  });

  test('returns fal engine when VIDEO_ENGINE=fal and key provided', () => {
    const engine = createVideoEngine({
      VIDEO_ENGINE: 'fal',
      OUTPUT_DIR: outputDir,
      FAL_API_KEY: 'test-key',
    });
    expect(engine.name).toBe('fal');
  });

  test('throws for fal engine without API key', () => {
    const original = process.env.FAL_API_KEY;
    delete process.env.FAL_API_KEY;

    expect(() => createVideoEngine({
      VIDEO_ENGINE: 'fal',
      OUTPUT_DIR: outputDir,
      FAL_API_KEY: '',
    })).toThrow(/FAL_API_KEY/);

    if (original) process.env.FAL_API_KEY = original;
  });

  test('returns error engine for unknown type', () => {
    const engine = createVideoEngine({ VIDEO_ENGINE: 'unknown_engine', OUTPUT_DIR: outputDir });
    expect(engine.name).toBe('unknown_engine');
  });

  test('unknown engine render throws with helpful message', async () => {
    const engine = createVideoEngine({ VIDEO_ENGINE: 'banana', OUTPUT_DIR: outputDir });
    const progress = [];

    await expect(engine.render({
      jobId: 'test',
      onProgress: (p) => progress.push(p),
    })).rejects.toThrow(/banana.*not yet implemented/);

    expect(progress).toContain(50);
  });
});
