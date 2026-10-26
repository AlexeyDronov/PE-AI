# Handoff: Harrowgate Deal Copilot (26 Oct 2026)

Read this first, then `docs/04-implementation-plan.md`, which is the source of truth for progress.

## 1. Read these docs, in this order
1. `docs/01-architecture-proposal.md` (approved): structure, data model, generic registries, hooks, agent design, testing.
2. `docs/02-design-system.md` (approved, v0.3): tokens, 70-20-10 royal palette, Source Serif 4 + IBM Plex, site map (§3), every page's sections (§5), component rules. **Dark mode rework is deferred**: tokens are wired, don't polish them.
3. `docs/03-coding-standards.md` (binding for everyone): never edit tests, R1–R6, definition of done for web work.
4. `docs/04-implementation-plan.md`: every step ticked with its date and review fixes. **Never start work that isn't a plan step**; add the step first.
5. `docs/05-agent-cost-design.md`: **DRAFT, awaiting the user's sign-off** (see §4).
6. `docs/TODO.md`: backlog. `docs/preview/theme-preview.html` is the approved visual reference (also published as an artifact).

## 2. User's core rules (from the original brief; non-negotiable)
- **R1** Data is defined in the backend only. The frontend reads through `useResource` and writes through `useCommand`, and computes no business maths (aggregates come from API summary endpoints).
- **R2** Every component is defined once in `components/ui` → `charts` → `domain` (props only) → `features/*View` (the only place hooks are called). Check visually in the browser.
- **R3** Mock data lives in SQLite as if it were production. Reads use a read-only engine (`mode=ro`); a write guard allows writable tables only and never touches seed rows.
- **R4** One write hook drives input → backend command → DB → live SSE `changed` event → refetch.
- **R5** An agent with search tools returns structured results; the API validates and persists them (the agent never touches the DB).
- **R6** Lean and generic: registries (`ResourceSpec`, `CommandSpec`, `ComputeSpec`, `JobKindSpec`, the web registry) rather than bespoke routes. No near-duplicates.
- **Stack:** Next.js 15 + TS; FastAPI + SQLModel + SQLite; ECharts + TanStack Table; Mastra 1.75 (Node) agent service; Tavily search.
- **TDD:** I write the tests first and confirm they fail for the right reason, run `python3 scripts/test_lock.py snapshot <name>`, then dispatch a subagent (**Sonnet 5.5, medium effort**) that must never create, edit or delete test files. Afterwards I run `verify <name>` and do my own full verification.

## 3. Mode of working the user expects
- **One plan step at a time:** test → lock → subagent build → **my own verification** → tick the plan with the date → **commit in plan order**.
- **Stop and ask** on any real decision, before any **paid live LLM run**, and when a step needs input such as keys. Give short reports and keep context lean: delegate building, but verify everything yourself; never trust a subagent's word.
- **My verification checklist:**
  - test lock shows no CHANGED or REMOVED;
  - `make test-api`;
  - web `npx vitest run` and `npx tsc --noEmit`;
  - `make codegen-check`, `make smoke-web`, `make smoke-agent` where relevant;
  - **browser review against live data** at 1440px in the light theme. This always finds real bugs; write a failing test for each before fixing it.
- **Commits:** identity passed per commit, `git -c user.name=kinnarishah -c user.email=kinnarirox20@gmail.com commit …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't change git config. **Never push** unless asked. zsh doesn't split variables, so run multi-command commit scripts with `bash script.sh`.
- The user is direct and impatient with long autonomous runs. When they say pause, pause and report.

## 4. Status
**Done and committed** (19 commits on `main`, nothing pushed; HEAD `9193ca7`):
- Phases 0–5: foundations, backend platform, finance services (screening, credit, LBO with sensitivity and max bid, fund IRR/TVPI/DPI, European distribution waterfall), cached compute, typed OpenAPI contract with codegen, web foundation, charts, app shell, feedback annotation tool.
- Phase 6 pages 6.1–6.11: Pipeline, Deal overview, Deal model (sliders, scenarios, Excel export), Portfolio, Platform, Covenants, Exits, Fund, Markets, Segment, Overview.
- Agent steps 7.1–7.3: Mastra server with token-protected `/jobs/:kind/start`, retrying API callbacks, nine tools with recorded and live-format fixtures, query templates, four playbooks, agents.
- Tests: API 256, web 229, agent 56; all green at last run.

**Uncommitted (left for the user's sign-off):**
- `docs/05-agent-cost-design.md` (new);
- `docs/04-implementation-plan.md`, with Phase 7 rewritten as 7.4–7.7 per that design.

**The provider decision is MADE, not pending.** On 26 Oct the user chose **Anthropic directly**: `claude-haiku-5-5` at **effort `medium`**, key `ANTHROPIC_API_KEY` in the repo-root `.env`. Reading `.env` is blocked by the user's permission rules; don't try, and load it at runtime only. OpenRouter is dropped because of its fee and VAT. They then asked to design the agent service for minimum cost per request, which became `05-agent-cost-design.md`.

**Waiting on the user:** approval of `05-agent-cost-design.md`. It changes autonomous agent loops into code-orchestrated workflows with 1–2 Haiku calls per job. I flagged that this departs from their original "researches on its own" brief.

## 5. Exact next step
1. Get the user's sign-off on `docs/05-agent-cost-design.md`. If they want changes, revise it.
2. On approval, commit the two docs (`Plan: agent cost design and Phase 7 rewrite`). At the same time fix two lines in the plan: 6.12 needs 7.5, 6.13 needs 7.6, 6.14 needs 7.7 (they currently say 7.4/7.5/7.6).
3. Build **7.4**:
   - Replace OpenRouter in `apps/agent/src/llm.ts`, the only place a model is created, with `@anthropic-ai/sdk`. Pin a version at least two weeks old (check registry dates; that rule is the user's preference for supply-chain safety).
   - Write one `callClaude` helper: explicit `cache_control` on the frozen system prompt, structured output via `output_config.format`, `output_config.effort: "medium"`, `max_tokens` per job, usage capture.
   - Rename config keys (`ANTHROPIC_API_KEY`, `MODEL_*` → `claude-haiku-5-5`), update `.env.example` and `docs/01` D3.
   - Add a tool-result cache, a cache-probe script, and usage stored on the job (API side).
   - Use the claude-api skill for SDK specifics; don't guess the API.
4. Then 7.5 teaser screen, 7.6 research, 7.7 memo, each ending in **one live run only after asking**, then pages 6.12–6.14, then Phase 8.

## 6. Environment gotchas
- **Toolchain** is in the home folder: `export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"` (the Makefile does this). Python 3.12 via uv, Node 22, pnpm 12, `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`.
- **Dev servers are all STOPPED** as of handoff (the user asked for this so the new session starts them). Start from Bash in the background:
  - web `npx next dev -p 3000` in `apps/web`;
  - API `uv run uvicorn app.main:app --port 8000 --reload --timeout-graceful-shutdown 3` in `apps/api`;
  - agent `API_URL=http://localhost:8000 AGENT_SERVICE_TOKEN=dev-service-token npx mastra dev --dir src/mastra` in `apps/agent`.
  - `make seed` rebuilds `apps/api/data/harrowgate.sqlite`; restart the API after schema changes.
- **Browser pane:** the preview tool can't spawn processes in Desktop, so `.claude/launch.json` has a `web` entry that attaches by URL (`preview_start name=web`). Use a fresh tab if an old tab shows stale HMR errors. Unit tests run with CSS off and ECharts mocked, so only the browser and `smoke-web` catch CSS-module and runtime chart errors; `chart-render.test.ts` renders options in real ECharts SSR.
- **Test lock:** snapshots are named per task, and an agent's `verify` lists ADDED files from other parallel tasks, which is expected. Snapshot again after your own test edits.
- **Mastra `dev`** bundles into `.mastra/output`. Playbooks live in `apps/agent/src/mastra/public/*.md` and `loadSkill` checks three locations; `make smoke-agent` verifies against the running server.
- **No agent running → research jobs fail cleanly** with "The Copilot agent is not reachable…" (by design).
- **Backlog** (`docs/TODO.md`): dark-mode rework (deferred); ResearchFinding.confidence → string enum (in 7.6); the 4.7 primitives still missing (Select, Tooltip, Dialog/Drawer, NumberField, Toast, Checkbox, Markdown, Combobox, Sparkline) are built when first needed.
- **Memory** for this project lives in `~/.claude/projects/-Users-kinnarishah-Desktop-PE-AI/memory/`, covering workflow rules and decisions.
