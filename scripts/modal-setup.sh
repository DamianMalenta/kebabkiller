#!/usr/bin/env bash
# Modal CLI setup + smoke (CPU). Reads MODAL_TOKEN_ID / MODAL_TOKEN_SECRET from env or backend/.env.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
MODAL_DIR="$ROOT/modal"

load_env_var() {
  local key="$1"
  if [[ -n "${!key:-}" ]]; then
    return 0
  fi
  if [[ -f "$ENV_FILE" ]]; then
    local line
    line="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
    if [[ -n "$line" ]]; then
      local val="${line#*=}"
      val="${val%\"}"
      val="${val#\"}"
      export "$key=$val"
    fi
  fi
}

load_env_var MODAL_TOKEN_ID
load_env_var MODAL_TOKEN_SECRET

if ! command -v python3 >/dev/null 2>&1; then
  echo "Brak python3." >&2
  exit 1
fi

python3 -m pip install -q -r "$MODAL_DIR/requirements.txt" --user
export PATH="${HOME}/.local/bin:${PATH}"

if [[ -z "${MODAL_TOKEN_ID:-}" || -z "${MODAL_TOKEN_SECRET:-}" ]]; then
  echo "Brak MODAL_TOKEN_ID / MODAL_TOKEN_SECRET."
  echo "Panel Modal → Settings → API tokens → Create token"
  echo "Dodaj do backend/.env:"
  echo "  MODAL_TOKEN_ID=ak-..."
  echo "  MODAL_TOKEN_SECRET=as-..."
  echo "Albo: modal token set --token-id ... --token-secret ..."
  exit 1
fi

modal token set \
  --token-id "$MODAL_TOKEN_ID" \
  --token-secret "$MODAL_TOKEN_SECRET" \
  --activate \
  --verify

echo "=== Modal token info ==="
modal token info

echo "=== CPU health smoke ==="
cd "$MODAL_DIR"
modal run health.py

echo "=== Tutorial square (optional) ==="
modal run get_started.py

echo "OK — Modal gotowy."
