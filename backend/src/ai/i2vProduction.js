import { resolveWanRenderParams } from '../video/wanConfig.js';

const LIVING_BACKGROUND_PROMPT =
  'Living background: ambient motion such as drifting smoke, flickering fire and glowing neon, while architecture and geometry stay stable.';

/**
 * Apply I2V profile constraints to a director plan — na NIEZALEŻNYCH osiach (Faza C):
 *   camera.static  → kadr statyczny (NIE zamraża tła)
 *   background     → żywe tło dokładane do promptu, niezależnie od kamery
 *   beats.single   → jeden beat
 *   anchorPrompt   → uziemienie POSTACI
 */
export function applyI2vProductionProfile(directorPlan, options = {}) {
  const params = resolveWanRenderParams({
    i2vProfile: options.i2vProfile || options.i2v_profile || directorPlan.i2v_profile || 'I2V_PRODUCTION',
    durationSec: options.durationSec ?? options.duration_sec ?? directorPlan.duration_sec,
    wanLength: options.wanLength ?? options.wan_length ?? directorPlan.wan_length,
  });

  const plan = { ...directorPlan, i2v_profile: params.profile };

  if (params.camera.static) {
    plan.cinematography = {
      ...(plan.cinematography || {}),
      camera_shot: plan.cinematography?.camera_shot || 'medium shot',
      camera_motion: 'static',
      lighting: plan.cinematography?.lighting || 'natural light',
    };
  }

  if (params.beats.single && plan.storyboard?.length > 1) {
    plan.storyboard = [plan.storyboard[0]];
  }
  if (params.beats.single && plan._motion_beats?.length > 1) {
    plan._motion_beats = [plan._motion_beats[0]];
  }

  // Żywe tło — niezależne od kamery (statyczna kamera ≠ zamrożone tło).
  if (params.background.motion !== 'frozen' && !plan.positive_prompt?.includes(LIVING_BACKGROUND_PROMPT)) {
    plan.positive_prompt = [plan.positive_prompt, LIVING_BACKGROUND_PROMPT].filter(Boolean).join(' ');
  }

  if (params.anchorPrompt) {
    const anchor = params.anchorPrompt;
    if (!plan.positive_prompt?.includes(anchor)) {
      plan.positive_prompt = [plan.positive_prompt, anchor].filter(Boolean).join(' ');
    }
  }

  plan.wan_length = params.length;
  plan.wan_denoise = params.denoise;
  plan.duration_sec = params.length / 24;

  return plan;
}
