#!/usr/bin/env bash
# Local Postgres, run under Apple's `container` runtime (no Docker on this
# machine). Port 5434 — 5432 and 5433 (cornice) are both taken. Postgres 16
# to match the version actually provisioned on Zerops.
set -euo pipefail

NAME=kerf-pg
VOLUME=kerf-pg
IMAGE=postgres:16
PORT=5434

case "${1:-}" in
  up)
    container volume create "$VOLUME" >/dev/null 2>&1 || true
    if container list --all 2>/dev/null | grep -q "^$NAME "; then
      container start "$NAME" >/dev/null 2>&1 || true
    else
      container run -d --name "$NAME" -p "$PORT:5432" \
        -e POSTGRES_USER=kerf -e POSTGRES_PASSWORD=kerf -e POSTGRES_DB=kerf \
        -v "$VOLUME:/var/lib/postgresql" -m 1g "$IMAGE" >/dev/null
    fi
    for _ in $(seq 1 60); do
      container exec "$NAME" pg_isready -U kerf >/dev/null 2>&1 && { echo "postgres ready on :$PORT"; exit 0; }
      sleep 1
    done
    echo "postgres did not become ready; try: $0 logs" >&2
    exit 1
    ;;
  down)   container stop "$NAME" >/dev/null 2>&1 && echo "stopped" ;;
  reset)  container delete -f "$NAME" >/dev/null 2>&1 || true
          container volume delete "$VOLUME" >/dev/null 2>&1 || true
          echo "removed container and volume; run '$0 up'" ;;
  shell)  container exec -it "$NAME" psql -U kerf -d kerf ;;
  logs)   container logs "$NAME" ;;
  *)      echo "usage: $0 {up|down|reset|shell|logs}" >&2; exit 2 ;;
esac
