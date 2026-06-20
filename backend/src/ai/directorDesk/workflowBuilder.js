/** Dynamic RunComfy workflow from negotiated project rules — no hardcoded profiles only. */

import { buildRunComfyWorkflow } from '../../video/runComfyEngine.js';
import { resolveWanRenderParams, I2V_PROFILES } from '../../video/wanConfig.js';

function mergeTags(tags = []) {
  return Array.from(new Set(tags.map((t) => String(t).trim()).filter(Boolean)));
}

/**
 * Żywe tło (Faza C, oś TŁO) — odpięte od ruchu kamery. Tło żyje (dym/ogień/neony),
 * geometria/architektura stała. Dokładane do promptu gdy `background.motion === 'alive'`,
 * NIEZALEŻNIE od `static_camera` (koniec zlepku: statyczna kamera ≠ zamrożone tło).
 */
export const LIVING_BACKGROUND_PROMPT =
  'Living background: ambient motion such as drifting smoke, flickering fire and glowing neon, while architecture and geometry stay stable.';

export function buildDynamicRenderRules({
  project,
  scene,
  directorPlan,
  generatorTags = [],
}) {
  const overrides = scene?.ai_overrides || {};
  const canon = project?.canon || {};
  const profileId = overrides.i2v_profile || canon.default_i2v_profile || 'I2V_PRODUCTION';
  const profile = I2V_PROFILES[profileId] || I2V_PROFILES.I2V_PRODUCTION;

  // Oś KAMERA — niezależna (ruch kadru/optyki)
  const cameraMotion = overrides.camera_motion || directorPlan?.cinematography?.camera_motion;
  const staticCamera = overrides.static_camera ?? (cameraMotion === 'static' || profile.camera.static);

  // Oś TŁO — niezależna od kamery: statyczna kamera nie zamraża tła
  const backgroundMotion = overrides.background_motion || profile.background.motion;
  const backgroundAlive = backgroundMotion !== 'frozen';

  // Oś BEATY
  const singleBeat = overrides.single_beat ?? profile.beats.single;

  return {
    i2v_profile: profileId,
    duration_sec: scene?.duration_sec ?? 4,
    denoise: overrides.denoise ?? profile.denoise,
    steps: overrides.steps ?? profile.steps,
    static_camera: staticCamera,
    camera_motion: cameraMotion || (staticCamera ? 'static' : 'tracking'),
    background_motion: backgroundMotion,
    background_alive: backgroundAlive,
    single_beat: singleBeat,
    fps: overrides.fps ?? 24,
    style_tags: mergeTags([
      ...(canon.style_tags || []),
      ...generatorTags,
      ...(overrides.style_tags || []),
    ]),
    continuity_mode: overrides.continuity_mode || (scene?.sort_order > 0 ? 'last_frame' : 'composite'),
    anchor_prompt: overrides.anchor_prompt || profile.anchorPrompt || null,
  };
}

/**
 * JEDNA wspólna funkcja enrichment dla podglądu I produkcji (Faza B, krok 4).
 * Wstrzykuje styl projektu (style_tags) + anchor do positive_prompt i dokleja
 * parametry I2V/continuity z reguł. Koniec „preview != prod" — oba tory wołają to samo.
 */
export function enrichDirectorForRender({
  directorJson,
  userPrompt,
  project,
  scene,
  generatorTags = [],
}) {
  const rules = buildDynamicRenderRules({
    project,
    scene,
    directorPlan: directorJson,
    generatorTags,
  });

  const enrichedDirector = {
    ...directorJson,
    i2v_profile: rules.i2v_profile,
    duration_sec: rules.duration_sec,
    wan_denoise: rules.denoise,
    static_camera: rules.static_camera,
    background_motion: rules.background_motion,
    dynamic_rules: rules,
    continuity_mode: rules.continuity_mode,
  };

  if (rules.style_tags.length) {
    enrichedDirector.positive_prompt = [
      directorJson?.positive_prompt || userPrompt,
      rules.style_tags.join(', '),
    ].filter(Boolean).join(', ');
  }

  // Żywe tło — niezależne od kamery (oś TŁO). Dokładane gdy tło żyje, NAWET przy static_camera.
  if (rules.background_alive) {
    enrichedDirector.positive_prompt = [
      enrichedDirector.positive_prompt || directorJson?.positive_prompt || userPrompt,
      LIVING_BACKGROUND_PROMPT,
    ].filter(Boolean).join(', ');
  }

  // Anchor = uziemienie POSTACI (nie tła) — tylko przy statycznej kamerze.
  if (rules.anchor_prompt && rules.static_camera) {
    enrichedDirector.positive_prompt = [
      enrichedDirector.positive_prompt,
      rules.anchor_prompt,
    ].filter(Boolean).join(', ');
  }

  return { enrichedDirector, rules };
}

export function buildDynamicWorkflowPayload({
  jobId,
  userPrompt,
  directorJson,
  processedAssets,
  project,
  scene,
  generatorTags,
}) {
  const { enrichedDirector, rules } = enrichDirectorForRender({
    directorJson,
    userPrompt,
    project,
    scene,
    generatorTags,
  });

  const { workflow_api_json } = buildRunComfyWorkflow(
    jobId,
    userPrompt,
    enrichedDirector,
    processedAssets,
  );

  const renderParams = resolveWanRenderParams({
    i2vProfile: rules.i2v_profile,
    durationSec: rules.duration_sec,
    denoise: rules.denoise,
  });

  return {
    workflow_api_json,
    render_params: renderParams,
    rules,
    continuity_mode: rules.continuity_mode,
  };
}

export function previewWorkflowForScene({
  jobId = 'preview',
  userPrompt,
  directorJson,
  project,
  scene,
  generatorTags,
}) {
  return buildDynamicWorkflowPayload({
    jobId,
    userPrompt,
    directorJson: directorJson || { positive_prompt: userPrompt },
    processedAssets: { startFrame: null },
    project,
    scene,
    generatorTags,
  });
}
