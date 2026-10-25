# Coding standards

Binding for everyone writing code in this repo, human or agent. The specs are `01-architecture-proposal.md` and `02-design-system.md`.

## Non-negotiables

1. **Never create, edit, move or delete a test file.** That covers anything under a `tests/` folder, anything named `test_*.py`, `*.test.ts(x)`, `*.spec.ts(x)` or `conftest.py`, and snapshot baselines. Tests are the specification. If a test looks wrong, stop and report it; don't work around it.
2. **Data lives in the backend.** The frontend never hard-codes domain data or business maths. It reads through `useResource` and writes through `useCommand`.
3. **Define once, reuse everywhere.** Before writing a function, hook or component, look for one that already does the job with different parameters, and extend it instead. No near-duplicates.
4. **Generic over specific.** Add a registry entry (a `ResourceSpec`, `CommandSpec`, `JobKindSpec`, or resource key) rather than a bespoke route or hook.
5. **Lean.** No speculative abstractions, no unused parameters, no dead code, no commented-out code.

## Python (`apps/api`)

- Python 3.12, FastAPI, SQLModel. Type hints everywhere; `ruff check` and `ruff format` must pass (config in `pyproject.toml`).
- Layers: `routers` → `services` (pure maths, no I/O) → `repositories`. Routers stay thin.
- Errors go through `app.core.errors`. Every error response has the shape `{"error": {"code": str, "message": str, "details"?: any}}`.
- IDs are ULID strings. Money is in £m, rates are fractions, multiples are floats.
- Comments only where intent isn't obvious. Docstrings are one line on public functions.

## TypeScript (`apps/web`, `apps/agent`)

- Strict TypeScript. No `any` and no non-null assertions. Domain types come from `packages/contracts`, never written by hand.
- Components: function components, props typed, `data-testid` on the root. Styling uses design tokens only, with no raw hex.
- Layering: `ui` ← `charts` ← `domain` ← pages. Only pages call hooks.

## Running things

All tools are on the PATH via the Makefile (`make test-api`, `make lint-api`). Outside make, prefix commands with `PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"`.

## Definition of done for web work

1. `npx vitest run` passes.
2. `npx tsc --noEmit` is clean.
3. `make smoke-web` passes against the running dev server (`next dev` on :3000). Unit tests run with CSS disabled and ECharts mocked, so only this check catches CSS-module errors and runtime rendering failures. Don't run `next build` while the dev server is running.
