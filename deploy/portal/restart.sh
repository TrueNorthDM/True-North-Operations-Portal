#!/usr/bin/env bash
# Restart the portal with the build it is already running, for example after a
# change to /opt/tnportal/portal.env. Run as the portal user:
#   /opt/tnportal/app/deploy/portal/restart.sh
# Images are tagged with their commit, not "latest", so the tag is read from
# the running container.
set -euo pipefail
cd /opt/tnportal/app
TAG="$(docker inspect --format '{{.Config.Image}}' tnportal-portal)"
PORTAL_TAG="${TAG##*:}" docker compose --env-file /opt/tnportal/portal.env \
  -f deploy/portal/docker-compose.yml up -d --no-build --force-recreate
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null http://127.0.0.1:3000/login && { echo "Live: ${TAG##*:}"; exit 0; }
  sleep 2
done
echo "The portal did not answer after the restart" >&2
exit 1
