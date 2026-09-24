#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# provision-shards.sh
# One-time setup: creates D1 databases for each shard account.
# Run this once before the first deploy.
#
# Prerequisites:
#   - CLOUDFLARE_API_TOKEN_{1..9} and CLOUDFLARE_ACCOUNT_ID_{1..9} set as
#     environment variables (or in .env)
#   - wrangler installed
#
# Usage:
#   bash scripts/provision-shards.sh
#
# Output:
#   Prints DATABASE_ID_{1..9} values. Add these to GitHub Actions secrets.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

TOTAL_SHARDS="${TOTAL_SHARDS:-9}"

for i in $(seq 1 "$TOTAL_SHARDS"); do
  TOKEN_VAR="CLOUDFLARE_API_TOKEN_${i}"
  ACCOUNT_VAR="CLOUDFLARE_ACCOUNT_ID_${i}"
  TOKEN="${!TOKEN_VAR:-}"
  ACCOUNT_ID="${!ACCOUNT_VAR:-}"

  if [[ -z "$TOKEN" || -z "$ACCOUNT_ID" ]]; then
    echo "ERROR: Missing ${TOKEN_VAR} or ${ACCOUNT_VAR}" >&2
    exit 1
  fi

  DB_NAME="shard-${i}-db"
  echo "Creating D1 '${DB_NAME}' in account ${i} (${ACCOUNT_ID})..."

  DATABASE_ID=$(CLOUDFLARE_API_TOKEN="$TOKEN" CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" \
    npx wrangler d1 create "$DB_NAME" 2>&1 | grep -oP 'database_id = "\K[^"]+')

  if [[ -z "$DATABASE_ID" ]]; then
    echo "ERROR: Failed to create D1 for shard ${i}" >&2
    exit 1
  fi

  echo "DATABASE_ID_${i}=${DATABASE_ID}"
done

echo ""
echo "Done. Add these as GitHub Actions secrets:"
echo "  DATABASE_ID_1 through DATABASE_ID_${TOTAL_SHARDS}"
