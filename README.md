# Harrowgate Deal Copilot

A private equity workspace for one fund. It covers the deal lifecycle: sourcing markets, screening teasers, modelling deals, drafting IC memos, monitoring portfolio companies and planning exits. AI agents do the reading and drafting. All the numbers come from a backend you can audit, never from the model.

## What it does

| Area | Pages | What you get |
|---|---|---|
| Overview | `/` | Fund at a glance: NAV, IRR, TVPI/DPI, dry powder, lifecycle, deals awaiting a decision, portfolio alerts |
| Origination | `/markets`, `/research` | Segment attractiveness, growth vs margin, multiple arbitrage; **market research agent** with cited sources |
| Deals | `/deals`, `/deals/new`, `/deals/[id]` | Pipeline with screening scores; **teaser screening agent** (paste text or upload PDF, Word or PowerPoint); deal overview, LBO model with live sliders, sensitivity and valuation range, Excel export; **IC memo agent** |
| Portfolio | `/portfolio`, `/portfolio/covenants`, `/exits` | Platform performance against budget, covenant headroom, value creation, exit routes |
| Fund | `/fund` | J-curve and distribution waterfall |

Each agent job costs about $0.001–0.005 in model calls. The page shows the cost alongside the result.

## Architecture

```
            browser
               │  HTTPS (REST + server-sent events)
               ▼
┌───────────────────────────┐    start job    ┌────────────────────────────┐
│ API  · FastAPI · :8000    │ ──────────────▶ │ Agent · Mastra · :4111     │
│ SQLite · LBO + valuation  │ ◀────────────── │ Claude (Anthropic) + Tavily│
│ maths · live events       │  results (auth) │ code-orchestrated workflows│
└───────────────────────────┘                 └────────────────────────────┘
               ▲
┌───────────────────────────┐
│ Web · Next.js 15 · :3000  │  React Query cache, kept fresh by the API's event stream
└───────────────────────────┘
```

- **The backend owns the data and the maths.** The web app reads through one generic hook (`useResource`) and writes through one (`useCommand`). After each write the API sends a `changed` event, and every open page refetches only what changed.
- **Agents return structured results.** The API validates and stores them. Agents never touch the database.
- **The contract is generated.** `packages/contracts` holds the OpenAPI document, and the TypeScript and Zod types are generated from it with `make codegen`. Web and agent compile against it.

| Part | Stack |
|---|---|
| `apps/web` | Next.js 15 (App Router, Turbopack in dev), React 19, TanStack Query and Table, ECharts (slim build, lazy loaded) |
| `apps/api` | Python 3.12, FastAPI, SQLModel on SQLite, openpyxl for exports, pypdf, python-docx and python-pptx for teaser uploads |
| `apps/agent` | Node 22, Mastra, Anthropic SDK (`claude-sonnet-5-5`), Tavily search |
| `packages/contracts` | Generated OpenAPI, TypeScript and Zod contract |
| `e2e` | Playwright flows and accessibility checks against an isolated stack |

## Run it locally

You need **Node 22+**, **pnpm** (the version pinned in `package.json`, via `corepack enable`), **Python 3.12** and **[uv](https://docs.astral.sh/uv/)**.

```bash
make setup
```

Create `.env` at the repo root from `.env.example`, and add your `ANTHROPIC_API_KEY` and `TAVILY_API_KEY`. The app runs without them, but the agent jobs need them. Then build the demo database (this wipes an existing one):

```bash
make seed
```

Start everything (API on :8000, agent on :4111, web on :3000) in one terminal. Ctrl-C stops all three:

```bash
make dev
```

Then open http://localhost:3000.

## Tests and checks

| Command | What it checks |
|---|---|
| `make test-api` | API unit and integration tests (pytest; each test seeds its own throwaway database) |
| `make lint-api` | ruff lint and format |
| `cd apps/web && npx vitest run` | Web unit tests |
| `cd apps/web && npx tsc --noEmit` | Web types |
| `make test-agent` | Agent tests (no live model calls) |
| `make codegen-check` | The generated contract matches the API |
| `make smoke-web` / `make smoke-agent` | Every route renders in the running dev server; both agents and all jobs are registered |
| `make e2e` | Playwright flows against an isolated stack (throwaway DB on :8100, fake agent, production build on :3100) |

## Configuration

| Variable | Used by | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY`, `TAVILY_API_KEY` | agent | Model and web search |
| `AGENT_SERVICE_TOKEN` | API, agent | Shared secret for agent ⇄ API calls |
| `API_URL` | agent | Where the agent sends results; required (locally `http://localhost:8000`) |
| `AGENT_URL` | API | Where the API starts jobs (default `http://localhost:4111`) |
| `DATABASE_PATH` | API | SQLite file (default `apps/api/data/harrowgate.sqlite`) |
| `CORS_ORIGINS` | API | JSON list of web origins allowed to call the API |
| `NEXT_PUBLIC_API_URL` | web | API base URL, fixed at build time (default `http://localhost:8000`) |
| `MODEL`, `EFFORT`, `MAX_SECONDS` | agent | Model choice, reasoning effort and per-job time budget |

## Deployment

The web app is on **Vercel**, and the API and agent run as containers on **Fly.io** (London) with the database on a Fly volume. The setup steps, secrets, database upload, backups and troubleshooting are in [docs/06-deployment.md](docs/06-deployment.md).

> There's no login yet. Anyone with the site URL can use it and start paid agent jobs.

## Repository layout

```
apps/
  web/        Next.js app: src/app (routes), src/features (pages), src/components (ui → charts → domain)
  api/        FastAPI app: routers, services (pure maths), repositories, jobs; seed/ builds the demo data
  agent/      Mastra server: agents, workflows, tools, playbooks (skills)
packages/
  contracts/  Generated OpenAPI + TypeScript + Zod
e2e/          Playwright tests
scripts/      codegen and smoke checks
docs/         deployment guide
```
