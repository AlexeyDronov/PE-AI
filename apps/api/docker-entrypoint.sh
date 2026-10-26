#!/bin/sh
# Container start: seed a database only if the volume has none yet, then serve over IPv4, which Fly's proxy and
# health checks use. (Python's "::" socket is IPv6-only, so it refused the proxy.)
set -e
if [ ! -f "$DATABASE_PATH" ]; then
  echo "No database at $DATABASE_PATH; seeding a fresh one"
  python -m seed.seed
fi
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips "*"
