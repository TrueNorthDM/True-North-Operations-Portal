#!/usr/bin/env bash
# Build and start the portal on its server, from the code in /opt/tnportal/app.
# Run as the portal user:  /opt/tnportal/app/deploy/portal/deploy.sh [git ref]
#
# 1. Fetches the code (main by default) and checks it out.
# 2. Builds a new image tagged with the commit, at low priority so the websites
#    on this server keep their share of the CPU.
# 3. Swaps the running container for the new one and waits for it to answer.
#    If it does not, the previous image is started again.
set -euo pipefail

APP=/opt/tnportal/app
ENV_FILE=/opt/tnportal/portal.env
REF="${1:-main}"
cd "$APP"

git fetch --quiet origin "$REF"
git checkout --quiet --detach FETCH_HEAD
SHA="$(git rev-parse --short HEAD)"
PREV="$(docker inspect --format '{{.Config.Image}}' tnportal-portal 2>/dev/null || true)"

echo "Building $SHA"
PORTAL_TAG="$SHA" nice -n 10 docker compose --env-file "$ENV_FILE" -f deploy/portal/docker-compose.yml build --pull
PORTAL_TAG="$SHA" docker compose --env-file "$ENV_FILE" -f deploy/portal/docker-compose.yml up -d

for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:3000/login"; then
    echo "Live: $SHA"
    # Keep this build and the one before it (the way back); drop older ones.
    docker images tnportal/portal --format '{{.Tag}}' \
      | grep -vxE "${SHA}|${PREV##*:}" \
      | xargs -r -I{} docker rmi "tnportal/portal:{}" >/dev/null 2>&1 || true
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 2
done

echo "The new build did not answer; going back to ${PREV:-nothing}" >&2
if [ -n "$PREV" ]; then
  PORTAL_TAG="${PREV##*:}" docker compose --env-file "$ENV_FILE" -f deploy/portal/docker-compose.yml up -d --no-build
fi
exit 1
