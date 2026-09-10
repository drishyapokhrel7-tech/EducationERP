#!/usr/bin/env bash
# One-command production deploy for the API.
#
# The Vercel project's production domain (education-erp-api.vercel.app)
# does NOT auto-follow `vercel deploy --prod` here — the alias has to
# be re-pointed by hand every time, and forgetting it leaves the app
# talking to a stale build. This wraps deploy + alias + smoke so that
# can't be half-done.
#
# Run from services/api:  ./scripts/deploy.sh
set -euo pipefail

ALIAS="education-erp-api.vercel.app"

echo "==> Deploying to production…"
# --yes prints progress + (sometimes) a JSON tail, so pull the last
# thing that actually looks like a deployment URL rather than tail -n1.
DEPLOY_OUT="$(vercel deploy --prod --yes 2>&1)"
DEPLOY_URL="$(printf '%s\n' "$DEPLOY_OUT" | grep -oE 'https://[a-z0-9-]+\.vercel\.app' | tail -n1)"
if [ -z "$DEPLOY_URL" ]; then
  printf '%s\n' "$DEPLOY_OUT"
  echo "!! could not parse a deployment URL from the output above" >&2
  exit 1
fi
echo "    $DEPLOY_URL"

echo "==> Pointing $ALIAS at the new deployment…"
vercel alias set "$DEPLOY_URL" "$ALIAS"

echo "==> Smoke test…"
node "$(dirname "$0")/smoke.mjs" "https://$ALIAS"

echo "==> Done."
