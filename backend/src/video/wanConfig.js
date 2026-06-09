/** Shared Wan 2.1 render settings — keep director prompt and GPU workflow in sync. */

const DEFAULT_WAN_LENGTH = 33; // ~1.4 s @ 24 fps — stabilny smoke test na RunComfy

function parseWanLength() {
  const raw = process.env.WAN_LENGTH?.trim();
  if (!raw) return DEFAULT_WAN_LENGTH;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 17 || parsed > 241) {
    console.warn(
      `[wanConfig] Invalid WAN_LENGTH="${raw}" — expected 17–241, using default ${DEFAULT_WAN_LENGTH}`,
    );
    return DEFAULT_WAN_LENGTH;
  }

  return parsed;
}

export const WAN_QUALITY = {
  width: 480,
  height: 832,
  length: parseWanLength(),
  steps: 20,
};

export const WAN_FORMAT_PROMPT = `Vertical 9:16 video, ${WAN_QUALITY.width}x${WAN_QUALITY.height}`;
