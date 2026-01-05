#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:8000}

echo "Evidence-related routes in openapi.json:"

curl -sS "$BASE_URL/openapi.json" \
  | jq -r '.paths | keys[]' \
  | grep -E "evidence|download" || true

printf "\nNext: use /download or /download-url with ORG_ID and ADMIN_ID.\n"
