import { describe, test, expect } from '@jest/globals';
import {
  extractMotionBeatsFromPolish,
  resolveDominantBeat,
  reconcileKinematicsWithPrompt,
  inferKinematicsFromPolish,
  isKinematicsContradictory,
} from '../ai/kinematicsFromPrompt.js';

const DEFAULT_STUDIO_PROMPT =
  'Kebabkiller siedzi w rozżarzonym piecu ceglanym. Nagle sztywno wyskakuje na stalowy blat — krótki skok jak bryła, ląduje i lekko się przechyla. Kamera zaczyna od zbliżenia na postać na blacie, potem wolno się oddala. Za kebabkillerem na ścianie pieca powstaje wielki, dramatyczny cień.';

describe('kinematicsFromPrompt', () => {
  test('extracts sitting then jumping beats in narrative order', () => {
    const beats = extractMotionBeatsFromPolish(DEFAULT_STUDIO_PROMPT);
    expect(beats.map((beat) => beat.state)).toEqual(['sitting', 'jumping']);
  });

  test('prefers post-transition dominant beat for multi-beat scenes', () => {
    const beats = extractMotionBeatsFromPolish(DEFAULT_STUDIO_PROMPT);
    const dominant = resolveDominantBeat(beats, DEFAULT_STUDIO_PROMPT);
    expect(dominant.state).toBe('jumping');
  });

  test('reconciles contradictory LLM kinematics using prompt cues only', () => {
    const llmKinematics = {
      subject_state: 'sitting',
      primary_motion: 'rigid body jump and tumble',
      velocity: 'static',
    };

    expect(isKinematicsContradictory(llmKinematics)).toBe(true);

    const { kinematics, changed } = reconcileKinematicsWithPrompt(DEFAULT_STUDIO_PROMPT, llmKinematics);
    expect(changed).toBe(true);
    expect(kinematics.subject_state).toBe('jumping');
    expect(kinematics.primary_motion).toMatch(/lowered seated pose.*rigid vertical hop/i);
  });

  test('does not override coherent LLM output', () => {
    const llmKinematics = {
      subject_state: 'jumping',
      primary_motion: 'vertical ascent from enclosed space to counter',
      velocity: 'rapid',
    };

    const { kinematics, changed } = reconcileKinematicsWithPrompt(DEFAULT_STUDIO_PROMPT, llmKinematics);
    expect(changed).toBe(false);
    expect(kinematics.subject_state).toBe('jumping');
    expect(kinematics.primary_motion).toBe('vertical ascent from enclosed space to counter');
  });

  test('infers kinematics for simple jump prompt without sitting', () => {
    const kinematics = inferKinematicsFromPolish('Kebabkiller wyskakuje z pieca na blat.');
    expect(kinematics.subject_state).toBe('jumping');
    expect(kinematics.primary_motion).toContain('rigid vertical hop');
  });

  test('leaves unknown scenes without invented motion', () => {
    const kinematics = inferKinematicsFromPolish('Kebabkiller patrzy w dal.');
    expect(kinematics.subject_state).toBe('standing');
    expect(kinematics.primary_motion).toBe('performs the described physical action');
  });
});
