import { describe, test, expect } from '@jest/globals';
import { WAN_FORMAT_PROMPT, WAN_QUALITY } from '../video/wanConfig.js';

describe('wanConfig', () => {
  test('WAN_QUALITY matches production 9:16 Wan 2.1 settings', () => {
    expect(WAN_QUALITY).toEqual({
      width: 480,
      height: 832,
      length: 33,
      steps: 20,
    });
  });

  test('WAN_FORMAT_PROMPT embeds WAN_QUALITY resolution', () => {
    expect(WAN_FORMAT_PROMPT).toContain(`${WAN_QUALITY.width}x${WAN_QUALITY.height}`);
    expect(WAN_FORMAT_PROMPT).toMatch(/9:16/i);
  });
});
