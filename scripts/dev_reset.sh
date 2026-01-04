#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

(
  cd "$ROOT_DIR"
  docker compose down -v
)

rm -f "$ROOT_DIR/.dev_ids.env"
rm -f "$ROOT_DIR/downloaded_README.md"
rm -f "$ROOT_DIR/local_download.md"
rm -f "$ROOT_DIR/gcs_download.md"

if [ -d "$ROOT_DIR/backend/.evidence_data" ]; then
  rm -rf "$ROOT_DIR/backend/.evidence_data"
fi

echo "Reset complete. Local dev artifacts removed."
