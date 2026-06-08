/** Shared Wan 2.1 render settings — keep director prompt and GPU workflow in sync. */
export const WAN_QUALITY = {
  width: 480,
  height: 832,
  length: 33,
  steps: 20,
};

export const WAN_FORMAT_PROMPT = `Vertical 9:16 video, ${WAN_QUALITY.width}x${WAN_QUALITY.height}`;
