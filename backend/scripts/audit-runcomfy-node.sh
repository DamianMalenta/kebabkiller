#!/usr/bin/env bash
# Node audit launcher (Windows PowerShell: npm run audit:runcomfy)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node --use-system-ca --experimental-sqlite "$(dirname "$0")/audit-runcomfy.mjs" "$@"
