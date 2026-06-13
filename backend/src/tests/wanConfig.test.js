import { describe, test, expect, afterEach } from '@jest/globals';
import {
  WAN_FORMAT_PROMPT,
  WAN_QUALITY,
  secondsToFrames,
  resolveWanRenderParams,
  I2V_PROFILES,
} from '../video/wanConfig.js';

describe('wanConfig', () => {
  afterEach(() => {
    delete process.env.WAN_LENGTH;
    delete process.env.WAN_DENOISE;
    delete process.env.I2V_PROFILE;
  });

  test('WAN_QUALITY matches smoke defaults', () => {
    expect(WAN_QUALITY).toEqual({
      width: 480,
      height: 832,
      length: 33,
      steps: 20,
      denoise: 1,
    });
  });

  test('WAN_FORMAT_PROMPT embeds WAN_QUALITY resolution', () => {
    expect(WAN_FORMAT_PROMPT).toContain(`${WAN_QUALITY.width}x${WAN_QUALITY.height}`);
    expect(WAN_FORMAT_PROMPT).toMatch(/9:16/i);
  });

  test('secondsToFrames maps duration to 24 fps frames', () => {
    expect(secondsToFrames(4)).toBe(96);
    expect(secondsToFrames(10)).toBe(240);
    expect(secondsToFrames(0.5)).toBe(17);
  });

  test('I2V_PRODUCTION profile uses lower denoise and per-scene length', () => {
    const params = resolveWanRenderParams({
      i2vProfile: 'I2V_PRODUCTION',
      durationSec: 5,
    });
    expect(params.profile).toBe('I2V_PRODUCTION');
    expect(params.denoise).toBe(I2V_PROFILES.I2V_PRODUCTION.denoise);
    expect(params.length).toBe(120);
    expect(params.staticCamera).toBe(true);
  });

  test('buildRunComfyWorkflow respects wan_denoise from director json', () => {
    const params = resolveWanRenderParams({
      i2vProfile: 'I2V_PRODUCTION',
      denoise: 0.9,
      durationSec: 3,
    });
    expect(params.denoise).toBe(0.9);
    expect(params.length).toBe(72);
  });

  test('I2V_PRODUCTION without duration_sec uses WAN_LENGTH from env', () => {
    process.env.WAN_LENGTH = '73';
    process.env.I2V_PROFILE = 'I2V_PRODUCTION';
    const params = resolveWanRenderParams({ i2vProfile: 'I2V_PRODUCTION' });
    expect(params.length).toBe(73);
    expect(params.denoise).toBe(I2V_PROFILES.I2V_PRODUCTION.denoise);
  });

  test('SMOKE uses WAN_DENOISE from env', () => {
    process.env.WAN_DENOISE = '0.7';
    const params = resolveWanRenderParams({ i2vProfile: 'SMOKE' });
    expect(params.denoise).toBe(0.7);
  });

  test('plan scene duration_sec overrides WAN_LENGTH env', () => {
    process.env.WAN_LENGTH = '73';
    const params = resolveWanRenderParams({
      i2vProfile: 'I2V_PRODUCTION',
      durationSec: 4,
    });
    expect(params.length).toBe(96);
  });
});
