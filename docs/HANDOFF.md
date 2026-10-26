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

## 4. Status (27 Oct)
**Phase 7 is complete** (steps 7.4–7.7 committed; nothing pushed). Anthropic direct, `claude-haiku-5-5` at effort `medium`, per `05-agent-cost-design.md` (approved). One live run per job type, all succeeded:
- **Cache probe:** call 2 read all 2,511 cached tokens.
- **Teaser:** $0.0012.
- **Research:** $0.0028, 7 code-verified findings.
- **Memo:** $0.0033, after raising the cap to 10,000 tokens.

Tests: API 280, web 229, agent 105, all green. `make smoke-agent` checks that every job kind is routable in the bundled server.

Keys in the repo-root `.env` (the user set them; never read the file): ANTHROPIC_API_KEY, TAVILY_API_KEY, COMPANIES_HOUSE_API_KEY. The user edited `.env.example` themselves; it's uncommitted and left for them.

## 5. Exact next step (27 Oct, end of session)
Done: 3.5, 4.7, 6.12–6.14, 8.1, 8.3, 8.4 round 1. **All servers are stopped.**

Open items:
- **8.2:** generate and commit the visual baselines (see the plan note).
- **8.4:** closed. The feedback tool was removed in 8.8; the one note still marked open (teaser document upload) was built in round 1.
- **8.5:** dark mode, deferred by the user.

The user is handing optimisation and the rest of the plan to the build/performance agent.

**Never run `make seed` on the dev DB:** it wipes agent-created deals, reports and memos (and the old feedback notes, still in the `annotations` table). E2E uses its own throwaway DB on :8100. Commands: `screenTeaser`, `startMarketResearch`, `draftMemo`; jobs carry `usage` for showing cost. Backlog: the Linden seed-data contradiction in `docs/TODO.md`.

Gotchas from Phase 7:
- **Restart the agent server after editing `.env`.** Env loads once, by searching up from `.mastra/output` (`envFilesUpward`).
- **The bundler drops side-effect imports.** Runners register through `registerJobRunners()`.
- **`make seed` wipes agent-created rows.**

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
