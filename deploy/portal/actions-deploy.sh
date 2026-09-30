#!/usr/bin/env bash
# The only thing GitHub Actions' key may do on this server (migration plan,
# step p4-deploy). It is the forced command for that key in
# /opt/tnportal/.ssh/authorized_keys:
#
#   restrict,command="/opt/tnportal/bin/actions-deploy.sh" ssh-ed25519 ... github-actions
#
# Allowed:  deploy <commit sha | main>   build and start that commit (deploy.sh)
#           status                       the running containers
# One deploy at a time (flock).
set -euo pipefail

cmd="${SSH_ORIGINAL_COMMAND:-}"
case "$cmd" in
  "deploy "*)
    ref="${cmd#deploy }"
    if ! [[ "$ref" =~ ^([0-9a-f]{7,40}|main)$ ]]; then echo "Not a commit: $ref" >&2; exit 2; fi
    exec 9>/opt/tnportal/.deploy.lock
    flock -n 9 || { echo "Another deploy is running." >&2; exit 3; }
    # Check the commit out first, so deploy.sh runs from that commit's copy.
    cd /opt/tnportal/app
    git fetch --quiet origin "$ref"
    git checkout --quiet --detach FETCH_HEAD
    /opt/tnportal/app/deploy/portal/deploy.sh "$ref" 2>&1 | tee -a /opt/tnportal/logs/deploy.log
    ;;
  status)
    docker ps --format '{{.Names}}: {{.Status}}'
    ;;
  *)
    echo "Allowed: deploy <commit>, status" >&2
    exit 2
    ;;
esac
