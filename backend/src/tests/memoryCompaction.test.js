import { describe, test, expect } from '@jest/globals';
import {
  mergeSummariesRuleBased,
  buildCompactionUserMessage,
  formatSceneContextBlock,
} from '../ai/memoryCompaction.js';
import { SERIES_MEMORY_MAX_CHARS } from '../ai/seriesContext.js';

describe('mergeSummariesRuleBased', () => {
  test('stays within character budget', () => {
    const old = 'A'.repeat(3000);
    const memory = mergeSummariesRuleBased(old, 'Kebabkiller = rigid dürüm wrap', {
      scene_pl: 'Kebabkiller skacze na blat.',
      action_en: 'jump',
      camera: 'medium shot, static',
      lighting: 'warm',
      tone: ['warm'],
    });

    expect(memory.length).toBeLessThanOrEqual(SERIES_MEMORY_MAX_CHARS);
    expect(memory).toContain('Kebabkiller skacze');
  });

  test('includes chronology in rule_based fallback', () => {
    const memory = mergeSummariesRuleBased(
      'Poprzednia ciągłość.',
      'Kebabkiller = sztywna bryła.',
      { scene_pl: 'Finał odcinka.' },
      { episodeNumber: 2, episodeTitle: 'Piec i cień', sceneIndex: 5 },
    );

    expect(memory).toContain('CHRONOLOGIA:');
    expect(memory).toContain('Odcinek: 2 — "Piec i cień"');
    expect(memory).toContain('Scena w odcinku: 5');
  });
});

describe('buildCompactionUserMessage', () => {
  test('includes episode and scene chronology in prompt', () => {
    const message = buildCompactionUserMessage({
      oldSeriesMemory: 'Poprzednia ciągłość.',
      styleBible: 'Kebabkiller = sztywna bryła.',
      newRenderSummary: {
        scene_pl: 'Finał odcinka — Kebabkiller na blacie.',
        action_en: 'stand on counter',
      },
      sceneContext: {
        episodeNumber: 2,
        episodeTitle: 'Piec i cień',
        sceneIndex: 5,
      },
    });

    expect(message).toContain('CHRONOLOGY:');
    expect(message).toContain('Odcinek: 2 — "Piec i cień"');
    expect(message).toContain('Scena w odcinku: 5');
    expect(message).toContain('chronologii odcinka i sceny');
  });

  test('formatSceneContextBlock reports unknown chronology when missing', () => {
    const block = formatSceneContextBlock({});
    expect(block).toContain('nieznana');
  });
});
