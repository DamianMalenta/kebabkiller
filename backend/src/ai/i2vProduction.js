import { resolveWanRenderParams } from '../video/wanConfig.js';

/** Apply I2V_PRODUCTION constraints to a director plan (static camera, 1 beat, anchor). */
export function applyI2vProductionProfile(directorPlan, options = {}) {
  const params = resolveWanRenderParams({
    i2vProfile: options.i2vProfile || options.i2v_profile || directorPlan.i2v_profile || 'I2V_PRODUCTION',
    durationSec: options.durationSec ?? options.duration_sec ?? directorPlan.duration_sec,
    wanLength: options.wanLength ?? options.wan_length ?? directorPlan.wan_length,
  });

  const plan = { ...directorPlan, i2v_profile: params.profile };

  if (params.staticCamera) {
    plan.cinematography = {
      ...(plan.cinematography || {}),
      camera_shot: plan.cinematography?.camera_shot || 'medium shot',
      camera_motion: 'static',
      lighting: plan.cinematography?.lighting || 'natural light',
    };
  }

  if (params.singleBeat && plan.storyboard?.length > 1) {
    plan.storyboard = [plan.storyboard[0]];
  }
  if (params.singleBeat && plan._motion_beats?.length > 1) {
    plan._motion_beats = [plan._motion_beats[0]];
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
