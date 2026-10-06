#!/usr/bin/env bash
# Build and start the portal on its server, from the code in /opt/tnportal/app.
# Run as the portal user:  /opt/tnportal/app/deploy/portal/deploy.sh [git ref] [production|staging]
#
#   staging      staging.truenorthportal.online: every push lands here first
#                (.github/workflows/deploy-staging.yml).
#   production   truenorthportal.online: only when a tested commit is promoted
#                (.github/workflows/deploy-server.yml, "Promote to production").
#
# 1. Fetches the code and checks out the commit (main, or a full or short hash).
# 2. Builds a new image tagged with the commit, at low priority so the websites
#    on this server keep their share of the CPU. Each environment has its own
#    build: the browser code carries that environment's addresses.
# 3. Swaps the running container for the new one and waits for it to answer.
#    If it does not, the previous image is started again.
set -euo pipefail

APP=/opt/tnportal/app
REF="${1:-main}"
ENVIRONMENT="${2:-production}"
case "$ENVIRONMENT" in
  production) ENV_FILE=/opt/tnportal/portal.env;  PROJECT=tnportal;         CONTAINER=tnportal-portal;  IMAGE=tnportal/portal;         PORT=3000 ;;
  staging)    ENV_FILE=/opt/tnportal/staging.env; PROJECT=tnportal-staging; CONTAINER=tnportal-staging; IMAGE=tnportal/portal-staging; PORT=3001 ;;
  *) echo "Unknown environment: $ENVIRONMENT (production or staging)" >&2; exit 2 ;;
esac
cd "$APP"

# Fetch everything, then resolve: GitHub cannot fetch a short hash by name.
git fetch --quiet origin
[ "$REF" = main ] && TARGET=origin/main || TARGET="$REF"
git checkout --quiet --detach "$(git rev-parse --verify "$TARGET^{commit}")"
SHA="$(git rev-parse --short HEAD)"
PREV="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
compose() { PORTAL_TAG="$1" docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f deploy/portal/docker-compose.yml "${@:2}"; }

echo "Building $SHA for $ENVIRONMENT"
PORTAL_TAG="$SHA" nice -n 10 docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f deploy/portal/docker-compose.yml build --pull
compose "$SHA" up -d

for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/login"; then
    echo "Live on $ENVIRONMENT: $SHA"
    # Keep this build and the one before it (the way back); drop older ones.
    docker images "$IMAGE" --format '{{.Tag}}' \
      | grep -vxE "${SHA}|${PREV##*:}" \
      | xargs -r -I{} docker rmi "$IMAGE:{}" >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
    # The build cache grows with every build (9.5 GB by 6 October 2026); keep 3 GB.
    docker builder prune -f --keep-storage 3gb >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "The new build did not answer; going back to ${PREV:-nothing}" >&2
if [ -n "$PREV" ]; then
  compose "${PREV##*:}" up -d --no-build
fi
exit 1
