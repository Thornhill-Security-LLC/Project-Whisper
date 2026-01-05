#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BASE_URL=${BASE_URL:-http://localhost:8000}
DEV_ENV_FILE="${ROOT_DIR}/.dev_ids.env"
EMAIL=${1:-"user-$(date +%s)@example.com"}
DISPLAY_NAME=${2:-"New User"}
ROLE=${3:-"org_member"}

if [ ! -f "$DEV_ENV_FILE" ]; then
  echo "Missing $DEV_ENV_FILE. Run scripts/dev_bootstrap.sh first." >&2
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

payload=$(jq -n \
  --arg email "$EMAIL" \
  --arg name "$DISPLAY_NAME" \
  --arg role "$ROLE" \
  '{email:$email, display_name:$name, role:$role}')

response=$(curl -sS -X POST "$BASE_URL/api/organisations/$ORG_ID/users" \
  -H "X-Organisation-Id: $ORG_ID" \
  -H "X-Actor-User-Id: $ADMIN_ID" \
  -H "Content-Type: application/json" \
  -d "$payload")

USER_ID=$(echo "$response" | jq -r '.id')
USER_ROLE=$(echo "$response" | jq -r '.role')

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  echo "Failed to parse user id from response:" >&2
  echo "$response" >&2
  exit 1
fi

if [ -z "$USER_ROLE" ] || [ "$USER_ROLE" = "null" ]; then
  echo "Failed to parse user role from response:" >&2
  echo "$response" >&2
  exit 1
fi

echo "USER_ID=$USER_ID"
echo "USER_ROLE=$USER_ROLE"
