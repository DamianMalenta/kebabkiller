import { describe, test, expect } from '@jest/globals';
import {
  SERIES_STEPS,
  EPISODE_STEPS,
  advanceWizardStep,
  getAllowedToolNames,
  resolveWizardMode,
  canAdvance,
} from '../ai/directorDesk/wizardStateMachine.js';

describe('wizardStateMachine', () => {
  test('resolves series mode when project wizard incomplete', () => {
    expect(resolveWizardMode({
      projectStep: SERIES_STEPS.STYLE,
      episodeStep: null,
      episodePlanId: null,
    })).toBe('series');
  });

  test('resolves episode mode when episode plan active', () => {
    expect(resolveWizardMode({
      projectStep: SERIES_STEPS.COMPLETE,
      episodeStep: EPISODE_STEPS.STORYBOARD,
      episodePlanId: 'plan-1',
    })).toBe('episode');
  });

  test('RBAC limits tools per step', () => {
    const tools = getAllowedToolNames('series', SERIES_STEPS.START);
    expect(tools).toContain('setProjectName');
    expect(tools).not.toContain('produceEpisode');
  });

  test('advance requires conditions', () => {
    const blocked = advanceWizardStep({
      mode: 'series',
      currentStep: SERIES_STEPS.START,
      context: {},
    });
    expect(blocked.ok).toBe(false);

    const ok = advanceWizardStep({
      mode: 'series',
      currentStep: SERIES_STEPS.START,
      context: { projectName: 'Kebabkiller' },
    });
    expect(ok.ok).toBe(true);
    expect(ok.step).toBe(SERIES_STEPS.STYLE);
  });

  test('canAdvance for canon confirm', () => {
    expect(canAdvance('series', SERIES_STEPS.CONFIRM, { canonConfirmed: true })).toBe(true);
    expect(canAdvance('series', SERIES_STEPS.CONFIRM, { canonConfirmed: false })).toBe(false);
  });
});
