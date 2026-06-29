"""CPU-only Modal health check — verifies auth without GPU spend."""

import modal

app = modal.App("kebabkiller-health")


@app.function()
def ping() -> dict:
    return {
        "ok": True,
        "service": "kebabkiller-modal",
        "phase": "scaffold",
    }


@app.local_entrypoint()
def main() -> None:
    result = ping.remote()
    print("Modal health:", result)
