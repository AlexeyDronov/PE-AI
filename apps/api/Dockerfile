# API image for Fly. Build context: apps/api. The SQLite file lives on a volume mounted at /data.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /usr/local/bin/uv

# Two levels deep: app/core/config.py looks two folders above the API for the repo root (and its optional .env).
WORKDIR /srv/app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/srv/app/.venv \
    PATH=/srv/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/data/harrowgate.sqlite

# Dependencies first, from the lockfile, so code changes don't reinstall them.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY seed ./seed
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 8000
CMD ["./docker-entrypoint.sh"]
