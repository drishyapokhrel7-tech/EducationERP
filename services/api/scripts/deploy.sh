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
DEPLOY_URL="$(vercel deploy --prod --yes | tail -n1 | tr -d '[:space:]')"
echo "    $DEPLOY_URL"

echo "==> Pointing $ALIAS at the new deployment…"
vercel alias set "$DEPLOY_URL" "$ALIAS"

echo "==> Smoke test…"
node "$(dirname "$0")/smoke.mjs" "https://$ALIAS"

echo "==> Done."
