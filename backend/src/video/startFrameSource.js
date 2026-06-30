/** Jawne źródło klatki startowej per scena — zero domyślnych fallbacków w produkcji. */

export const START_FRAME_SOURCE = Object.freeze({
  DARKROOM: 'darkroom',
  PREVIOUS_SCENE: 'previous_scene',
});

const ALLOWED = new Set(Object.values(START_FRAME_SOURCE));

export function isValidStartFrameSource(value) {
  return value != null && ALLOWED.has(value);
}

/**
 * Efektywne źródło sceny (tylko wartość z DB — bez zgadywania).
 * Scena 1 (sort_order 0) przy INSERT dostaje domyślnie 'darkroom' w upsertPlanScene.
 */
export function resolveSceneStartFrameSource(scene) {
  if (!scene?.start_frame_source) return null;
  return isValidStartFrameSource(scene.start_frame_source) ? scene.start_frame_source : null;
}

export function assertStartFrameSourceForScene(scene, source) {
  if (!isValidStartFrameSource(source)) {
    throw new Error(
      `Nieprawidłowe start_frame_source. Dozwolone: ${[...ALLOWED].join(', ')}.`,
    );
  }
  if (scene.sort_order === 0 && source !== START_FRAME_SOURCE.DARKROOM) {
    throw new Error('Scena 1 musi mieć źródło klatki: darkroom (nowe zdjęcie).');
  }
  if (scene.sort_order > 0 && source === START_FRAME_SOURCE.DARKROOM) {
    return;
  }
  if (scene.sort_order > 0 && source === START_FRAME_SOURCE.PREVIOUS_SCENE) {
    return;
  }
}

export function planUsesExplicitStartFrameSources(plan) {
  return (plan?.scenes || []).some((scene) => scene.start_frame_source != null);
}
