import { describe, test, expect } from '@jest/globals';
import {
  SERIES_STEPS,
  EPISODE_STEPS,
  FREE_STEP,
  advanceWizardStep,
  getAllowedToolNames,
  resolveWizardMode,
  canAdvance,
} from '../ai/directorDesk/wizardStateMachine.js';
import { getToolDefinitions } from '../ai/directorDesk/agentTools.js';

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

  test('canAdvance(ASSETS) wymaga przypisanych assetów (assetsReady)', () => {
    expect(canAdvance('episode', EPISODE_STEPS.ASSETS, { assetsReady: true })).toBe(true);
    expect(canAdvance('episode', EPISODE_STEPS.ASSETS, { assetsReady: false })).toBe(false);
    expect(canAdvance('episode', EPISODE_STEPS.ASSETS, {})).toBe(false);
  });

  test('allowlista nie zawiera martwych (niezaimplementowanych) narzędzi', () => {
    const combos = [
      ...Object.values(SERIES_STEPS).map((s) => ['series', s]),
      ...Object.values(EPISODE_STEPS).map((s) => ['episode', s]),
      ['free', FREE_STEP],
    ];
    for (const [mode, step] of combos) {
      const allowed = getAllowedToolNames(mode, step);
      const defs = getToolDefinitions(allowed);
      const defined = new Set(defs.map((d) => d.name));
      const missing = allowed.filter((n) => !defined.has(n));
      expect({ mode, step, missing }).toEqual({ mode, step, missing: [] });
    }
  });

  test('usunięto setSceneAnchors i reorderScenes z allowlisty', () => {
    const allEpisode = Object.values(EPISODE_STEPS)
      .flatMap((s) => getAllowedToolNames('episode', s));
    expect(allEpisode).not.toContain('setSceneAnchors');
    expect(allEpisode).not.toContain('reorderScenes');
  });
});
