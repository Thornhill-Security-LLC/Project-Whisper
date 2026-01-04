#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BASE_URL=${BASE_URL:-http://localhost:8000}
ORG_NAME=${ORG_NAME:-"Acme Security"}
ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@example.com"}
ADMIN_DISPLAY_NAME=${ADMIN_DISPLAY_NAME:-"Admin User"}
DEV_ENV_FILE="${ROOT_DIR}/.dev_ids.env"

payload=$(jq -n \
  --arg org "$ORG_NAME" \
  --arg email "$ADMIN_EMAIL" \
  --arg name "$ADMIN_DISPLAY_NAME" \
  '{organisation_name:$org, admin_email:$email, admin_display_name:$name}')

response=$(curl -sS -X POST "$BASE_URL/api/bootstrap" \
  -H "Content-Type: application/json" \
  -d "$payload")

ORG_ID=$(echo "$response" | jq -r '.organisation.id')
ADMIN_ID=$(echo "$response" | jq -r '.admin_user.id')

if [ -z "$ORG_ID" ] || [ "$ORG_ID" = "null" ]; then
  echo "Failed to parse organisation id from response:" >&2
  echo "$response" >&2
  exit 1
fi

if [ -z "$ADMIN_ID" ] || [ "$ADMIN_ID" = "null" ]; then
  echo "Failed to parse admin user id from response:" >&2
  echo "$response" >&2
  exit 1
fi

cat <<EOF_IDS > "$DEV_ENV_FILE"
ORG_ID=$ORG_ID
ADMIN_ID=$ADMIN_ID
EOF_IDS

echo "ORG_ID=$ORG_ID"
echo "ADMIN_ID=$ADMIN_ID"
echo "Saved IDs to $DEV_ENV_FILE"
echo "Next: run 'make upload' to attach sample evidence."
