#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BASE_URL=${BASE_URL:-http://localhost:8000}
DEV_ENV_FILE="${ROOT_DIR}/.dev_ids.env"
FILE_PATH=${1:-"${ROOT_DIR}/README.md"}
EVIDENCE_TYPE=${EVIDENCE_TYPE:-"policy"}
EVIDENCE_TITLE=${EVIDENCE_TITLE:-"$(basename "$FILE_PATH")"}

if [ ! -f "$DEV_ENV_FILE" ]; then
  echo "Missing $DEV_ENV_FILE. Run scripts/dev_bootstrap.sh first." >&2
  exit 1
fi

if [ ! -f "$FILE_PATH" ]; then
  echo "File not found: $FILE_PATH" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
. "$DEV_ENV_FILE"
set +a

if [ -z "${ORG_ID:-}" ] || [ -z "${ADMIN_ID:-}" ]; then
  echo "ORG_ID and ADMIN_ID must be set in $DEV_ENV_FILE" >&2
  exit 1
fi

response=$(curl -sS -X POST "$BASE_URL/api/organisations/$ORG_ID/evidence/upload" \
  -H "X-Organisation-Id: $ORG_ID" \
  -H "X-Actor-User-Id: $ADMIN_ID" \
  -F "evidence_type=$EVIDENCE_TYPE" \
  -F "title=$EVIDENCE_TITLE" \
  -F "file=@${FILE_PATH}")

EVIDENCE_ID=$(echo "$response" | jq -r '.id')
STORAGE_BACKEND=$(echo "$response" | jq -r '.storage_backend')

if [ -z "$EVIDENCE_ID" ] || [ "$EVIDENCE_ID" = "null" ]; then
  echo "Failed to parse evidence id from response:" >&2
  echo "$response" >&2
  exit 1
fi

echo "EVIDENCE_ID=$EVIDENCE_ID"
echo "EVIDENCE_ID=$EVIDENCE_ID" >> "$DEV_ENV_FILE"

echo "Saved EVIDENCE_ID to $DEV_ENV_FILE"

if [ "$STORAGE_BACKEND" = "gcs" ]; then
  download_response=$(curl -sS \
    -H "X-Organisation-Id: $ORG_ID" \
    -H "X-Actor-User-Id: $ADMIN_ID" \
    "$BASE_URL/api/organisations/$ORG_ID/evidence/$EVIDENCE_ID/download-url")

  url=$(echo "$download_response" | jq -r '.url')
  expires_in=$(echo "$download_response" | jq -r '.expires_in')

  printf "Download URL (expires in %ss): %s\n" "$expires_in" "$url"
  printf "Download URL (expires in %ss): %s\n" "$expires_in" "$url" \
    > "$ROOT_DIR/gcs_download.md"
  echo "Saved GCS download info to $ROOT_DIR/gcs_download.md"
else
  basename_file=$(basename "$FILE_PATH")
  if [ "$basename_file" = "README.md" ]; then
    download_target="$ROOT_DIR/downloaded_README.md"
  else
    download_target="$ROOT_DIR/local_download.md"
  fi

  curl -sS -L -o "$download_target" \
    -H "X-Organisation-Id: $ORG_ID" \
    -H "X-Actor-User-Id: $ADMIN_ID" \
    "$BASE_URL/api/organisations/$ORG_ID/evidence/$EVIDENCE_ID/download"

  echo "Downloaded evidence to $download_target"
fi

echo "Next: run 'make routes' to inspect evidence routes."
