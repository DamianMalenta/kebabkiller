"""
Wan I2V render contract — shared shape for RunComfy today, Modal tomorrow.

Node IDs match backend/src/video/wan_workflow_api.json and runComfyEngine.js.
Full Comfy install + GPU image lands in a follow-up PR after RunComfy live tests.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# Mirrors runComfyEngine.js exports
WEBM_OUTPUT_NODE_ID = "52"
WEBP_OUTPUT_NODE_ID = "51"
LOAD_IMAGE_NODE_ID = "59"
WAN_I2V_NODE_ID = "54"
KSAMPLER_NODE_ID = "56"


@dataclass(frozen=True)
class WanRenderRequest:
    job_id: str
    positive_prompt: str
    negative_prompt: str
    width: int = 480
    height: int = 832
    length: int = 33
    steps: int = 20
    denoise: float = 1.0
    seed: int = 0
    start_image: str | None = None  # base64 data URI or storage path


def validate_wan_request(req: WanRenderRequest) -> None:
    if not req.job_id:
        raise ValueError("job_id is required")
    if not req.positive_prompt:
        raise ValueError("positive_prompt is required")
    if not req.start_image:
        raise ValueError("start_image is required (Klatka Zero / snapshot)")
    if req.length < 17 or req.length > 241:
        raise ValueError(f"length must be 17–241 frames, got {req.length}")


def describe_workflow_contract() -> dict[str, Any]:
    """Documentation payload for Node ↔ Modal integration."""
    return {
        "workflow_template": "backend/src/video/wan_workflow_api.json",
        "output_node": WEBM_OUTPUT_NODE_ID,
        "omit_nodes": [WEBP_OUTPUT_NODE_ID],
        "inject_nodes": {
            "positive": "55",
            "negative": "53",
            "wan_i2v": WAN_I2V_NODE_ID,
            "ksampler": KSAMPLER_NODE_ID,
            "load_image": LOAD_IMAGE_NODE_ID,
        },
        "format": "webm",
        "fps": 24,
    }
