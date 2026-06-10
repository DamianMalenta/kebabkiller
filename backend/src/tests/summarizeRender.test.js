import { describe, test, expect } from '@jest/globals';
import { extractRenderSummary, formatRenderSummaryForPrompt } from '../ai/summarizeRender.js';

describe('extractRenderSummary', () => {
  test('extracts compact fields without prompts or paths', () => {
    const job = { user_prompt: 'Kebabkiller wyskakuje z pieca. Na ścianie wielki cień.' };
    const directorJson = {
      scene_summary: 'rigid jump from oven onto counter',
      cinematography: {
        camera_shot: 'close-up',
        camera_motion: 'dolly out',
        lighting: 'warm oven light',
      },
      kinematics: {
        subject_state: 'jumping',
        primary_motion: 'vertical hop as rigid body',
        velocity: 'rapid',
      },
      positive_prompt: 'SHOULD NOT APPEAR IN SUMMARY',
      negative_prompt: 'human arms, hands',
      character_ref: '/uploads/secret.jpg',
    };

    const summary = extractRenderSummary(job, directorJson, {
      characterName: 'Kebabkiller',
      backgroundName: 'Piec_Brick',
    });

    expect(summary.scene_pl).toContain('cień');
    expect(summary.action_en).toBe('rigid jump from oven onto counter');
    expect(summary.camera).toBe('close-up, dolly out');
    expect(summary.character).toBe('Kebabkiller');
    expect(summary.tone).toContain('dramatic');
    expect(summary.continuity_notes).toMatch(/cien/i);

    const formatted = formatRenderSummaryForPrompt(summary);
    expect(formatted).not.toContain('positive_prompt');
    expect(formatted).not.toContain('/uploads');
    expect(formatted).not.toContain('human arms');
  });
});
