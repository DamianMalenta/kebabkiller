import { describe, test, expect } from '@jest/globals';
import { classifyIntentHeuristic, INTENTS } from '../ai/directorDesk/intentRouter.js';

describe('intentRouter', () => {
  test('classifies brainstorm questions', () => {
    expect(classifyIntentHeuristic('Nie rozumiem, co to jest denoise?', { inWizard: false }))
      .toBe(INTENTS.CREATIVE_BRAINSTORM);
  });

  test('classifies project commands', () => {
    expect(classifyIntentHeuristic('Usuń scenę 2', { inWizard: false }))
      .toBe(INTENTS.PROJECT_COMMAND);
  });

  test('defaults to wizard in series mode', () => {
    expect(classifyIntentHeuristic('Mroczny kebab z pieca', { wizardMode: 'series', inWizard: true }))
      .toBe(INTENTS.WIZARD_STEP);
  });
});
