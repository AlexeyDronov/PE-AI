#!/bin/sh
# Regenerates the API contract: OpenAPI document from the app (no server needed), then TypeScript types.
# Usage: scripts/codegen.sh [output-dir]   (default: packages/contracts)
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-$ROOT/packages/contracts}
mkdir -p "$OUT/src"
(cd "$ROOT/apps/api" && uv run python -c "
import json
from app.main import create_app
print(json.dumps(create_app().openapi(), indent=2, sort_keys=True))
") > "$OUT/openapi.json"
"$ROOT/apps/web/node_modules/.bin/openapi-typescript" --default-non-nullable false "$OUT/openapi.json" -o "$OUT/src/openapi.ts"
