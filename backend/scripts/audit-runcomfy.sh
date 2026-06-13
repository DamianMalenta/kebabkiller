#!/usr/bin/env bash
# Audyt deploymentu RunComfy bez panelu — ustawienia, workflow, custom node'y.
# Użycie:
#   cd backend && ./scripts/audit-runcomfy.sh
#   ./scripts/audit-runcomfy.sh --request-id <uuid>   # status / podpowiedź cancel
# Wymaga: curl, jq. Czyta RUNCOMFY_* z backend/.env (lub ze środowiska).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"
LOCAL_WORKFLOW="$BACKEND_DIR/src/video/wan_workflow_api.json"
API_BASE="https://api.runcomfy.net"
REQUEST_ID=""

usage() {
  sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --request-id) REQUEST_ID="${2:?brak wartości po --request-id}"; shift 2 ;;
    *) echo "Nieznany argument: $1" >&2; usage 1 ;;
  esac
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Brak polecenia: $1 (zainstaluj i spróbuj ponownie)" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd jq

# Git Bash ships msys curl with broken Schannel CRL on some Windows hosts — prefer Windows curl.
if [[ "$(uname -s 2>/dev/null)" == MINGW* ]] && [[ -x /c/Windows/System32/curl.exe ]]; then
  CURL=(/c/Windows/System32/curl.exe --ssl-no-revoke)
else
  CURL=(curl)
fi

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

load_env_var RUNCOMFY_API_KEY
load_env_var RUNCOMFY_ENDPOINT
load_env_var WAN_LENGTH
load_env_var I2V_PROFILE

if [[ -z "${RUNCOMFY_API_KEY:-}" ]]; then
  echo "Brak RUNCOMFY_API_KEY — ustaw w backend/.env lub w środowisku." >&2
  exit 1
fi

if [[ -z "${RUNCOMFY_ENDPOINT:-}" ]]; then
  echo "Brak RUNCOMFY_ENDPOINT — ustaw w backend/.env lub w środowisku." >&2
  exit 1
fi

DEPLOY_ID="$(printf '%s' "$RUNCOMFY_ENDPOINT" | sed -n 's|.*/deployments/\([^/]*\)/.*|\1|p')"
if [[ -z "$DEPLOY_ID" ]]; then
  echo "Nie udało się wyciągnąć deployment_id z RUNCOMFY_ENDPOINT:" >&2
  echo "  $RUNCOMFY_ENDPOINT" >&2
  exit 1
fi

api_get() {
  local url="$1"
  "${CURL[@]}" -fsS "$url" -H "Authorization: Bearer ${RUNCOMFY_API_KEY}" -H "Accept: application/json"
}

hardware_label() {
  case "$1" in
    TURING_16) echo "T4 / A4000 (16 GB VRAM) — za mało na Wan 14B" ;;
    AMPERE_24) echo "A10G / A5000 (24 GB) — na granicy dla Wan 14B" ;;
    AMPERE_48) echo "A6000 (48 GB) — typowe dla Wan 14B" ;;
    ADA_48_PLUS) echo "L40S / L40 (48 GB+)" ;;
    AMPERE_80) echo "A100 (80 GB) — szybciej, drożej/h" ;;
    ADA_80_PLUS) echo "H100 (80 GB+) — najszybsze, najdroższe/h" ;;
    HOPPER_141) echo "H200 (141 GB)" ;;
    *) echo "$1" ;;
  esac
}

warn_keep_warm() {
  local sec="$1"
  if [[ "$sec" -le 120 ]]; then
    echo "OK (krótki keep-warm)"
  elif [[ "$sec" -le 600 ]]; then
    echo "Średni — GPU może świecić kilka min po jobie"
  else
    echo "Wysoki — więcej płatnych minut idle po renderze"
  fi
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "=== Kebabkiller — audyt RunComfy ==="
echo "Czas: $(date -Iseconds)"
echo "Deployment ID: $DEPLOY_ID"
echo "Lokalnie: WAN_LENGTH=${WAN_LENGTH:-33}, I2V_PROFILE=${I2V_PROFILE:-SMOKE}"
echo ""

echo "--- 1. Ustawienia deploymentu ---"
DEPLOY_JSON="$TMP_DIR/deploy.json"
if ! api_get "${API_BASE}/prod/v2/deployments/${DEPLOY_ID}?includes=payload&includes=readme" >"$DEPLOY_JSON"; then
  echo "Błąd API przy GET deployment — sprawdź klucz i ID." >&2
  exit 1
fi

NAME="$(jq -r '.name // "(brak nazwy)"' "$DEPLOY_JSON")"
HW="$(jq -r '.hardware[0] // "?"' "$DEPLOY_JSON")"
MIN_INST="$(jq -r '.min_instances // 0' "$DEPLOY_JSON")"
MAX_INST="$(jq -r '.max_instances // 0' "$DEPLOY_JSON")"
QUEUE="$(jq -r '.queue_size // 0' "$DEPLOY_JSON")"
KEEP_WARM="$(jq -r '.keep_warm_duration_in_seconds // 0' "$DEPLOY_JSON")"
ENABLED="$(jq -r '.is_enabled // false' "$DEPLOY_JSON")"
STATUS="$(jq -r '.status // "?"' "$DEPLOY_JSON")"
WF_VER="$(jq -r '.workflow_version // "?"' "$DEPLOY_JSON")"
UPDATED="$(jq -r '.updated_at // "?"' "$DEPLOY_JSON")"
WF_ID="$(jq -r '.workflow_id // "?"' "$DEPLOY_JSON")"

echo "Nazwa:           $NAME"
echo "Workflow ID:     $WF_ID"
echo "Wersja workflow: $WF_VER (updated: $UPDATED)"
echo "Hardware:        $HW — $(hardware_label "$HW")"
echo "min_instances:   $MIN_INST $([[ "$MIN_INST" == "0" ]] && echo '(OK — brak stałego GPU)' || echo '(UWAGA — płacisz za GPU nawet bez jobów)')"
echo "max_instances:   $MAX_INST"
echo "queue_size:      $QUEUE"
echo "keep_warm:       ${KEEP_WARM}s — $(warn_keep_warm "$KEEP_WARM")"
echo "is_enabled:      $ENABLED"
echo "status:          $STATUS"
echo ""

echo "--- 2. Workflow na serwerze (payload) ---"
NODE_COUNT="$(jq '.payload.workflow_api_json | keys | length' "$DEPLOY_JSON")"
echo "Liczba nodów w workflow_api_json: $NODE_COUNT"

echo "Typy nodów (class_type):"
jq -r '.payload.workflow_api_json | to_entries[] | .value.class_type' "$DEPLOY_JSON" 2>/dev/null | sort -u | sed 's/^/  - /' || echo "  (brak payload.workflow_api_json)"

HAS_51="$(jq -r '.payload.workflow_api_json["51"] // empty | .class_type // empty' "$DEPLOY_JSON")"
HAS_52="$(jq -r '.payload.workflow_api_json["52"] // empty | .class_type // empty' "$DEPLOY_JSON")"
echo ""
echo "Node 51 (WEBP fallback): ${HAS_51:-BRAK}"
echo "Node 52 (SaveWEBM):       ${HAS_52:-BRAK}"
if [[ -n "$HAS_51" && -z "$HAS_52" ]]; then
  echo "  UWAGA: tylko WEBP — API może nie zwracać WEBM."
elif [[ -n "$HAS_51" && -n "$HAS_52" ]]; then
  echo "  INFO: oba outputy — upewnij się, że Studio dostaje node 52 (nasz kod omija 51)."
fi

echo ""
echo "Modele w workflow (serwer):"
jq -r '
  .payload.workflow_api_json
  | to_entries[]
  | select(.value.inputs.unet_name? // .value.inputs.clip_name? // .value.inputs.vae_name? // .value.inputs.clip_name?)
  | "\(.key) \(.value.class_type): \(.value.inputs.unet_name // .value.inputs.clip_name // .value.inputs.vae_name // "")"
' "$DEPLOY_JSON" 2>/dev/null | sed 's/^/  /' || true

echo ""
echo "--- 3. Custom node'y (object_info) ---"
OBJECT_URL="$(jq -r '.payload.object_info_url // empty' "$DEPLOY_JSON")"
if [[ -z "$OBJECT_URL" ]]; then
  echo "Brak object_info_url w payload."
else
  OBJECT_JSON="$TMP_DIR/object_info.json"
  if "${CURL[@]}" -fsS "$OBJECT_URL" -o "$OBJECT_JSON"; then
    CUSTOM_COUNT="$(jq 'keys | length' "$OBJECT_JSON")"
    echo "URL: $OBJECT_URL"
    echo "Zainstalowanych typów nodów: $CUSTOM_COUNT"
    if [[ "$CUSTOM_COUNT" -gt 25 ]]; then
      echo "  UWAGA: >25 typów — prawdopodobnie ciężkie środowisko (ryzyko wolnego startu / freeze)."
    else
      echo "  OK: stosunkowo lekkie środowisko."
    fi
    if jq -e 'keys[] | select(test("(?i)manager"))' "$OBJECT_JSON" >/dev/null 2>&1; then
      echo "  UWAGA: wykryto ComfyUI-Manager (zwykle niepotrzebny na produkcji)."
    fi
    echo "Wan / WEBM:"
    jq -r 'keys[]' "$OBJECT_JSON" | grep -iE 'wan|webm|save' | sed 's/^/  - /' || echo "  (brak dopasowań wan/webm)"
  else
    echo "Nie udało się pobrać object_info.json"
  fi
fi

echo ""
echo "--- 4. Porównanie z lokalnym workflow (Studio) ---"
if [[ -f "$LOCAL_WORKFLOW" ]]; then
  LOCAL_COUNT="$(jq 'keys | length' "$LOCAL_WORKFLOW")"
  LOCAL_TYPES="$(jq -r 'to_entries[] | .value.class_type' "$LOCAL_WORKFLOW" | sort -u | tr '\n' ', ' | sed 's/, $//')"
  echo "Lokalny plik: $LOCAL_WORKFLOW"
  echo "Nody lokalne: $LOCAL_COUNT — $LOCAL_TYPES"
  LOCAL_52="$(jq -r '.["52"].class_type // empty' "$LOCAL_WORKFLOW")"
  echo "Lokalny node 52: ${LOCAL_52:-BRAK}"
  if [[ "$NODE_COUNT" != "$LOCAL_COUNT" ]]; then
    echo "  INFO: inna liczba nodów serwer ($NODE_COUNT) vs lokalnie ($LOCAL_COUNT) — Studio i tak wysyła lokalny JSON przy renderze."
  fi
else
  echo "Brak pliku $LOCAL_WORKFLOW"
fi

if [[ -n "$REQUEST_ID" ]]; then
  echo ""
  echo "--- 5. Status requestu: $REQUEST_ID ---"
  STATUS_JSON="$TMP_DIR/request_status.json"
  if api_get "${API_BASE}/prod/v2/deployments/${DEPLOY_ID}/requests/${REQUEST_ID}/status" >"$STATUS_JSON"; then
    jq . "$STATUS_JSON"
    REQ_STATUS="$(jq -r '.status // "?"' "$STATUS_JSON")"
  echo ""
  echo "Anulowanie (jeśli wisi):"
  echo "  curl -X POST \"${API_BASE}/prod/v2/deployments/${DEPLOY_ID}/requests/${REQUEST_ID}/cancel\" \\"
  echo "    -H \"Authorization: Bearer \$RUNCOMFY_API_KEY\""
    if [[ "$REQ_STATUS" == "in_progress" || "$REQ_STATUS" == "in_queue" ]]; then
      echo ""
      echo "  UWAGA: job nadal aktywny ($REQ_STATUS) — rozważ cancel powyżej."
    fi
  else
    echo "Nie udało się odczytać statusu requestu." >&2
  fi
fi

echo ""
echo "--- Podsumowanie ---"
ISSUES=0
[[ "$MIN_INST" != "0" ]] && { echo "• min_instances > 0 — stały koszt GPU"; ISSUES=$((ISSUES + 1)); }
[[ "$KEEP_WARM" -gt 600 ]] && { echo "• długi keep_warm (${KEEP_WARM}s)"; ISSUES=$((ISSUES + 1)); }
[[ -n "$HAS_51" && -z "$HAS_52" ]] && { echo "• brak SaveWEBM (node 52) na serwerze"; ISSUES=$((ISSUES + 1)); }
if [[ -n "${OBJECT_JSON:-}" ]] && [[ "${CUSTOM_COUNT:-0}" -gt 25 ]]; then
  echo "• dużo custom node'ów ($CUSTOM_COUNT) — poproś RunComfy o ComfyUI-Minimal"
  ISSUES=$((ISSUES + 1))
fi
if [[ "$ISSUES" -eq 0 ]]; then
  echo "Brak oczywistych czerwonych flag w konfiguracji (problemy runtime nadal możliwe)."
fi
echo ""
echo "Pełny JSON deploymentu: zapisz ręcznie:"
echo "  curl -s \"${API_BASE}/prod/v2/deployments/${DEPLOY_ID}?includes=payload\" \\"
echo "    -H \"Authorization: Bearer \$RUNCOMFY_API_KEY\" | jq . > runcomfy-audit.json"
echo ""
echo "Gotowe."
