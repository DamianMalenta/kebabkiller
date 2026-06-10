import { describe, test, expect } from '@jest/globals';
import { applyI2vProductionProfile } from '../ai/i2vProduction.js';

describe('applyI2vProductionProfile', () => {
  test('forces static camera and single beat', () => {
    const plan = applyI2vProductionProfile({
      positive_prompt: 'Kebabkiller jumps',
      cinematography: { camera_shot: 'wide shot', camera_motion: 'dolly in', lighting: 'dramatic' },
      storyboard: [{ beat: 1 }, { beat: 2 }],
      _motion_beats: ['sit', 'jump'],
    }, { durationSec: 4 });

    expect(plan.cinematography.camera_motion).toBe('static');
    expect(plan.storyboard).toHaveLength(1);
    expect(plan._motion_beats).toHaveLength(1);
    expect(plan.wan_length).toBe(96);
    expect(plan.wan_denoise).toBe(0.85);
    expect(plan.positive_prompt).toMatch(/feet firmly on ground/i);
  });
});
