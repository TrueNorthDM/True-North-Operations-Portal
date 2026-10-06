#!/usr/bin/env bash
# The only thing GitHub Actions' key may do on this server (migration plan,
# step p4-deploy). It is the forced command for that key in
# /opt/tnportal/.ssh/authorized_keys:
#
#   restrict,command="/opt/tnportal/bin/actions-deploy.sh" ssh-ed25519 ... github-actions
#
# Allowed:  staging <commit sha | main>  build and start that commit on staging
#           deploy <commit sha | main>   the same on production (promote)
#           status                       the running containers
# One build at a time, either environment (flock).
set -euo pipefail

cmd="${SSH_ORIGINAL_COMMAND:-}"
case "$cmd" in
  "deploy "*|"staging "*)
    if [[ "$cmd" == staging* ]]; then env=staging; ref="${cmd#staging }"; else env=production; ref="${cmd#deploy }"; fi
    if ! [[ "$ref" =~ ^([0-9a-f]{7,40}|main)$ ]]; then echo "Not a commit: $ref" >&2; exit 2; fi
    exec 9>/opt/tnportal/.deploy.lock
    flock -n 9 || { echo "Another deploy is running." >&2; exit 3; }
    # Check the commit out first, so deploy.sh runs from that commit's copy.
    # Fetch everything, then resolve: GitHub cannot fetch a short hash by name.
    cd /opt/tnportal/app
    git fetch --quiet origin
    [ "$ref" = main ] && target=origin/main || target="$ref"
    git checkout --quiet --detach "$(git rev-parse --verify "$target^{commit}")"
    /opt/tnportal/app/deploy/portal/deploy.sh "$ref" "$env" 2>&1 | tee -a /opt/tnportal/logs/deploy.log
    ;;
  status)
    docker ps --format '{{.Names}}: {{.Status}}'
    ;;
  *)
    echo "Allowed: staging <commit>, deploy <commit>, status" >&2
    exit 2
    ;;
esac
