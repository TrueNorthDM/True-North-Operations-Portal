#!/bin/sh
# The portal's Supabase services. Usage: supabase.sh up | down | ps | logs [service]
# Realtime, edge functions and the pooler are left out: the portal does not use them.
set -e
cd /opt/tnportal/supabase
SERVICES="db auth rest storage imgproxy meta studio api-gw"
case "$1" in
  up)   docker compose up -d $SERVICES ;;
  down) docker compose stop $SERVICES ;;
  ps)   docker compose ps ;;
  logs) shift; docker compose logs --tail=80 "$@" ;;
  *)    echo "usage: $0 up|down|ps|logs [service]"; exit 1 ;;
esac
