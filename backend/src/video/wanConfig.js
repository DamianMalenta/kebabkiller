/** Shared Wan 2.1 render settings — keep director prompt and GPU workflow in sync. */

export const WAN_FPS = 24;
export const WAN_FRAME_MIN = 17;
export const WAN_FRAME_MAX = 241;

const DEFAULT_WAN_LENGTH = 33; // ~1.4 s @ 24 fps — stabilny smoke test na RunComfy
const DEFAULT_WAN_DENOISE = 1;

/** Production profiles for I2V clip rendering (F0). */
export const I2V_PROFILES = {
  SMOKE: {
    id: 'SMOKE',
    staticCamera: false,
    singleBeat: false,
    denoise: 1,
    steps: 20,
    defaultLength: DEFAULT_WAN_LENGTH,
  },
  I2V_PRODUCTION: {
    id: 'I2V_PRODUCTION',
    staticCamera: true,
    singleBeat: true,
    denoise: 0.85,
    steps: 20,
    defaultLength: 97, // ~4 s @ 24 fps
    anchorPrompt: 'Feet firmly on ground surface, subject grounded on floor, no levitation, no floating.',
  },
};

function parseWanLength() {
  const raw = process.env.WAN_LENGTH?.trim();
  if (!raw) return DEFAULT_WAN_LENGTH;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < WAN_FRAME_MIN || parsed > WAN_FRAME_MAX) {
    console.warn(
      `[wanConfig] Invalid WAN_LENGTH="${raw}" — expected ${WAN_FRAME_MIN}–${WAN_FRAME_MAX}, using default ${DEFAULT_WAN_LENGTH}`,
    );
    return DEFAULT_WAN_LENGTH;
  }

  return parsed;
}

function parseWanDenoise() {
  const raw = process.env.WAN_DENOISE?.trim();
  if (!raw) return DEFAULT_WAN_DENOISE;

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    console.warn(`[wanConfig] Invalid WAN_DENOISE="${raw}" — expected 0–1, using default ${DEFAULT_WAN_DENOISE}`);
    return DEFAULT_WAN_DENOISE;
  }

  return parsed;
}

export function parseI2vProfileId() {
  const raw = (process.env.I2V_PROFILE || 'SMOKE').trim().toUpperCase();
  return I2V_PROFILES[raw] ? raw : 'SMOKE';
}

function clampFrames(frames) {
  return Math.min(WAN_FRAME_MAX, Math.max(WAN_FRAME_MIN, Math.round(frames)));
}

/** Map scene duration (seconds) to Wan frame count @ 24 fps. */
export function secondsToFrames(seconds, fps = WAN_FPS) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_WAN_LENGTH;
  }
  const clampedSec = Math.min(10, Math.max(0.7, seconds));
  return clampFrames(clampedSec * fps);
}

/** Resolve GPU params for a single clip render.
 *  Length: duration_sec > wan_length > WAN_LENGTH env (wszystkie profile).
 *  Denoise: jawny override > profil (I2V_PRODUCTION 0.85) | SMOKE → WAN_DENOISE env.
 */
export function resolveWanRenderParams(options = {}) {
  const profileId = (options.i2vProfile || options.i2v_profile || parseI2vProfileId()).toUpperCase();
  const profile = I2V_PROFILES[profileId] || I2V_PROFILES.SMOKE;

  let length;
  if (options.durationSec != null || options.duration_sec != null) {
    length = secondsToFrames(options.durationSec ?? options.duration_sec);
  } else if (options.wanLength != null || options.wan_length != null) {
    length = clampFrames(options.wanLength ?? options.wan_length);
  } else {
    length = parseWanLength();
  }

  let denoise;
  if (options.denoise != null || options.wan_denoise != null) {
    denoise = options.denoise ?? options.wan_denoise;
  } else if (profileId === 'SMOKE') {
    denoise = parseWanDenoise();
  } else {
    denoise = profile.denoise ?? parseWanDenoise();
  }

  return {
    profile: profile.id,
    width: 480,
    height: 832,
    length,
    steps: profile.steps,
    denoise,
    staticCamera: profile.staticCamera,
    singleBeat: profile.singleBeat,
    anchorPrompt: profile.anchorPrompt || null,
  };
}

/** Legacy export — smoke-test defaults from env. */
export const WAN_QUALITY = {
  width: 480,
  height: 832,
  length: parseWanLength(),
  steps: 20,
  denoise: parseWanDenoise(),
};

export const WAN_FORMAT_PROMPT = `Vertical 9:16 video, ${WAN_QUALITY.width}x${WAN_QUALITY.height}`;
