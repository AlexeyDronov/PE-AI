#!/bin/sh
# Container start: seed a database only if the volume has none yet, then serve on every interface
# (Fly's private network is IPv6, so "::").
set -e
if [ ! -f "$DATABASE_PATH" ]; then
  echo "No database at $DATABASE_PATH; seeding a fresh one"
  python -m seed.seed
fi
exec uvicorn app.main:app --host :: --port 8000 --proxy-headers --forwarded-allow-ips "*"
