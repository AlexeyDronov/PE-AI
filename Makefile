# Toolchain lives in the user's home folder (no system installs).
export PATH := $(HOME)/.local/node/bin:$(HOME)/.local/bin:$(PATH)
export COREPACK_ENABLE_DOWNLOAD_PROMPT := 0

API := apps/api

.PHONY: setup seed test test-api lint-api snapshot-tests verify-tests dev-api dev-agent test-agent codegen codegen-check e2e

setup:
	cd $(API) && uv sync

seed:
	cd $(API) && uv run python -m seed.seed

test: test-api

test-api:
	cd $(API) && uv run pytest -q

lint-api:
	cd $(API) && uv run ruff check . && uv run ruff format --check .

dev-api:
	cd $(API) && uv run uvicorn app.main:app --reload --port 8000 --timeout-graceful-shutdown 3

# Test lock: hash every test file before a subagent runs; verify afterwards.
snapshot-tests:
	python3 scripts/test_lock.py snapshot

verify-tests:
	python3 scripts/test_lock.py verify

dev-agent:
	cd apps/agent && pnpm dev

test-agent:
	cd apps/agent && npx vitest run

dev-web:
	cd apps/web && pnpm dev

# Every route must compile and render in the running dev server (catches CSS/build errors unit tests can't).
smoke-web:
	sh scripts/smoke-web.sh

# API contract: openapi.json and the TypeScript types generated from it.
codegen:
	sh scripts/codegen.sh

codegen-check:
	@tmp=$$(mktemp -d) && sh scripts/codegen.sh $$tmp \
	  && diff -u packages/contracts/openapi.json $$tmp/openapi.json \
	  && diff -u packages/contracts/src/openapi.ts $$tmp/src/openapi.ts \
	  && echo "contracts up to date"; status=$$?; rm -rf $$tmp; exit $$status

# The running agent server must load both agents with their playbooks (bundled code, which vitest can't exercise).
smoke-agent:
	sh scripts/smoke-agent.sh

# Playwright flows against an isolated stack (throwaway DB on :8100, fake agent on :4199, web on :3100).
e2e:
	pnpm --filter @harrowgate/e2e exec playwright test $(E2E_ARGS)
