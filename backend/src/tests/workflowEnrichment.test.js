import { describe, test, expect } from '@jest/globals';
import {
  enrichDirectorForRender,
  buildDynamicWorkflowPayload,
} from '../ai/directorDesk/workflowBuilder.js';

const PROJECT = {
  canon: { style_tags: ['neon noir'], default_i2v_profile: 'I2V_PRODUCTION' },
};
const SCENE = { duration_sec: 4, sort_order: 0, ai_overrides: {} };

describe('enrichDirectorForRender (jedna wspólna funkcja: preview = prod)', () => {
  test('wstrzykuje style_tags + generatorTags + anchor do positive_prompt', () => {
    const { enrichedDirector } = enrichDirectorForRender({
      directorJson: { positive_prompt: 'base prompt' },
      userPrompt: 'base prompt',
      project: PROJECT,
      scene: SCENE,
      generatorTags: ['[Tryb Akcji]'],
    });

    expect(enrichedDirector.positive_prompt).toContain('base prompt');
    expect(enrichedDirector.positive_prompt).toContain('neon noir');
    expect(enrichedDirector.positive_prompt).toContain('[Tryb Akcji]');
    // anchor I2V_PRODUCTION (static) dopisany na końcu
    expect(enrichedDirector.positive_prompt).toContain('Feet firmly on ground');
    expect(enrichedDirector.i2v_profile).toBe('I2V_PRODUCTION');
    expect(enrichedDirector.continuity_mode).toBe('composite');
  });

  test('podgląd (buildDynamicWorkflowPayload) używa tego samego enrichment', () => {
    const args = {
      directorJson: { positive_prompt: 'base prompt' },
      userPrompt: 'base prompt',
      project: PROJECT,
      scene: SCENE,
      generatorTags: ['[Tryb Akcji]'],
    };
    const { enrichedDirector } = enrichDirectorForRender(args);
    const payload = buildDynamicWorkflowPayload({
      jobId: 'preview',
      processedAssets: { startFrame: null },
      ...args,
    });

    // node 55 = positive prompt → musi być identyczny jak ze wspólnego enrichment
    expect(payload.workflow_api_json['55'].inputs.text).toBe(enrichedDirector.positive_prompt);
    expect(payload.continuity_mode).toBe('composite');
  });

  test('bez style_tags positive_prompt zostaje nietknięty (poza anchorem static)', () => {
    const { enrichedDirector } = enrichDirectorForRender({
      directorJson: { positive_prompt: 'czysty prompt' },
      userPrompt: 'czysty prompt',
      project: { canon: { default_i2v_profile: 'SMOKE' } },
      scene: { duration_sec: 4, sort_order: 0, ai_overrides: {} },
      generatorTags: [],
    });
    // SMOKE nie jest static i nie ma anchora → prompt bez zmian
    expect(enrichedDirector.positive_prompt).toBe('czysty prompt');
  });
});
