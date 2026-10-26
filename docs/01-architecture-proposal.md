# Harrowgate Deal Copilot — Architecture Proposal

Status: **APPROVED** 25 Oct 2026 · Version 0.2 · 25 Oct 2026
Companion: [02-design-system.md](02-design-system.md)

---

## 1. Purpose and scope

An internal tool for a mid-market PE fund. Associates and partners use it to:

The product follows the fund's lifecycle. The full site map and page-by-page sections are in design doc §3 and §5.

| Stage | Pages | Job |
|---|---|---|
| Overview | `/` | What needs attention today: alerts, decisions, Copilot activity |
| 1 · Where to look | Markets, Segment, Research | Compare sub-sectors; commission the research agent; read cited reports |
| 2 · What to buy | Pipeline, Screen a teaser, Deal overview | Score deals against the buyout criteria; screen new teasers with an LLM |
| 3 · What to pay | Deal model, IC memo | Run the LBO with live assumptions; generate the IC memo and Excel model |
| 4 · How it's going | Portfolio, Platform, Covenants | Monitor EBITDA vs budget, covenants, value creation, alerts |
| 5 · When to sell | Exits, Fund performance | Exit planning; J-curve, distributions, fund returns |

The prototype (`reference/prototype.html`) is used for direction only. No code is carried over.

---

## 2. Governing rules (from the brief) and how the architecture enforces each

| # | Rule | Enforcement |
|---|---|---|
| R1 | Data defined only at the backend; the frontend reads through hooks and holds only static/UI state | Domain types are **generated** from FastAPI's OpenAPI schema; the web app has no hand-written domain types and no business maths. A lint rule bans `fetch` outside `lib/api/`. |
| R2 | Every component defined once, reused by import | `components/ui` (primitives) → `components/charts` → `components/domain` (compositions). Pages may only import from these. A `/dev/components` gallery renders every component in every state; Playwright screenshots it. |
| R3 | Mock data treated as production, in a DB, read-only | Seeded SQLite. Reads use a separate **read-only connection** (`mode=ro`). Seeded tables have no write path at all. |
| R4 | One hook reads user input, transforms, writes back, exposes the new data live | One generic `useCommand` hook → `POST /api/commands/{name}` → backend handler writes → server-sent event → every `useResource` subscribed to that resource refetches. |
| R5 | Autonomous agent with search tools returns structured results | Mastra agent service (Node). Output is a Zod schema generated from the same OpenAPI contract; FastAPI validates again before writing. |
| R6 | Lean, parameterised, reusable functions | One read hook, one write hook, one router factory, one repository class, one job pipeline, one chart wrapper. New features add **registry entries**, not new plumbing. |

---

## 3. System overview

```
┌──────────────────────────┐   HTTP (JSON)  ┌─────────────────────────────┐
│  web  (Next.js, TS)      │ ─────────────▶ │  api  (FastAPI, Python)     │
│  useResource / useCommand│ ◀── SSE ────── │  routers → services → repos │
└──────────────────────────┘                │        │            │       │
                                            │        ▼            ▼       │
                                            │  SQLite: read conn (ro) /   │
                                            │          write conn (cmds)  │
                                            └─────┬────────────▲──────────┘
                                   start job      │            │ job events + result
                                                  ▼            │ (service token)
                                            ┌─────────────────────────────┐
                                            │  agent (Mastra, Node)       │──▶ Anthropic API
                                            │  agents · workflows · tools │──▶ Web search API
                                            └─────────────────────────────┘
```

- **The API is the only process that touches the database.** The agent never writes to SQLite; it hands results back to the API, which validates and persists them.
- **All LLM calls live in the agent service** (teaser extraction, market research, memo drafting). FastAPI stays deterministic: data, maths, persistence. *(Decision D3 — see §11.)*
- The browser talks only to the API. The agent service is not exposed to the browser.

---

## 4. Repository layout (monorepo)

```
pe-ai/
├── apps/
│   ├── web/            Next.js 15 (App Router), TypeScript, pnpm
│   ├── api/            FastAPI, Python 3.12, uv
│   └── agent/          Mastra server, Node 22, TypeScript
├── packages/
│   └── contracts/      openapi.json (exported from api) + generated TS types + Zod schemas
├── docs/               this proposal, design system, ADRs
├── reference/          prototype (read-only, not imported)
├── scripts/            test snapshot / verify, codegen, dev runner
└── Makefile            make dev | test | seed | codegen | snapshot-tests | verify-tests
```

`packages/contracts` is the single bridge: `make codegen` exports OpenAPI from the API and regenerates `types.ts` (openapi-typescript) and `schemas.ts` (Zod, for the agent). CI fails if regenerated output differs from the committed output.

---

## 5. Backend — `apps/api`

### 5.1 Layout

```
app/
├── main.py                 app factory, router registration
├── core/                   config (pydantic-settings), db engines, errors, events (SSE bus)
├── models/                 SQLModel tables = the data classes (§6)
├── schemas/                read models / DTOs returned to clients (Pydantic)
├── repositories/
│   └── repository.py       Repository[T] — generic read (list/get/filter/sort/paginate)
├── services/               pure domain maths, no I/O
│   ├── screening.py        criteria scorecard, verdict, risk flags, buyout checklist
│   ├── credit.py           debt capacity, coverage, covenant headroom
│   ├── lbo.py              LBO engine (S&U, schedule, sweep, returns, sensitivity grid)
│   ├── portfolio.py        value-creation bridge, J-curve, distribution waterfall
│   └── market.py           segment attractiveness, multiple arbitrage
├── resources.py            RESOURCE REGISTRY (read side)
├── commands/               COMMAND REGISTRY (write side) — one handler per command
├── jobs/                   generic job runner + agent client
├── exports/                xlsx (openpyxl) LBO model, memo markdown/docx
└── routers/
    ├── factory.py          make_resource_router(spec) — builds GET list/detail routes
    ├── compute.py          POST /api/compute/{name}
    ├── commands.py         POST /api/commands/{name}
    ├── events.py           GET  /api/events (SSE)
    └── internal.py         agent callbacks (service-token auth)
seed/
├── fixtures/*.yaml         hand-authored entities (companies, segments, portfolio…)
├── generators.py           deterministic series (quarterly KPIs, cash flows) — fixed RNG seed
└── seed.py                 builds db from scratch; idempotent
tests/                      pytest — unit (services), contract (routers), integration (jobs)
```

### 5.2 The four generic building blocks

**1. `Repository[T]`** — one class, parameterised by model. Read-only methods only.

```python
class Repository(Generic[T]):
    def __init__(self, model: type[T], session: Session): ...
    def list(self, *, filters: Mapping[str, Any] = {}, sort: str | None = None,
             limit: int = 200, offset: int = 0) -> Page[T]: ...
    def get(self, id: str) -> T: ...                      # raises NotFound
```

**2. `ResourceSpec` + `make_resource_router`** — every read endpoint is a registry entry.

```python
@dataclass(frozen=True)
class ResourceSpec:
    name: str                       # "deals" → GET /api/deals, /api/deals/{id}
    model: type[SQLModel]
    read_schema: type[BaseModel]
    filters: tuple[str, ...] = ()   # allowed query filters
    enrich: Callable | None = None  # optional service call, e.g. attach screening score
    detail_only: bool = False

RESOURCES = [
  ResourceSpec("segments", Segment, SegmentRead),
  ResourceSpec("deals", Deal, DealRead, filters=("verdict", "stage", "segment_id"),
               enrich=screening.attach_score),
  ResourceSpec("portfolio-companies", PortfolioCompany, PortfolioCompanyRead, enrich=portfolio.attach_status),
  ResourceSpec("kpi-series", KpiPoint, KpiPointRead, filters=("company_id", "metric")),
  ...
]
```

Derived values (score, verdict, headroom) are **computed on read** from stored facts, never stored, so they cannot drift.

**3. `ComputeSpec`** — stateless, idempotent calculations (`POST /api/compute/{name}`). Same contract as a resource from the frontend's point of view (cached by input).

| name | input | output |
|---|---|---|
| `lbo` | `LboAssumptions` (deal id, case, sliders) | `LboResult` (S&U, schedule, returns, credit stats) |
| `lbo-sensitivity` | `LboAssumptions` + axes | `Grid` (entry × exit → IRR) |
| `debt-capacity` | deal id, leverage policy | `DebtCapacity` |
| `valuation-range` | deal id | `RangeSeries` (football field) |

**4. `CommandSpec`** — the only write path (`POST /api/commands/{name}`).

```python
@dataclass(frozen=True)
class CommandSpec:
    name: str
    input_schema: type[BaseModel]
    handler: Callable[[Input, WriteSession], Result]
    invalidates: tuple[str, ...]     # resource names to broadcast on success
    async_job: JobKind | None = None # if set: creates a Job and returns it immediately
```

| command | async job | writes | invalidates |
|---|---|---|---|
| `screen-teaser` | `teaser_screen` | Teaser, Deal, DealFinancials, RiskFlag, DiligenceQuestion | deals, jobs |
| `start-market-research` | `market_research` | ResearchReport, ResearchFinding, Source | research-reports, jobs |
| `draft-memo` | `memo_draft` | Memo, MemoSection | memos, jobs |
| `save-scenario` | — | LboScenario | lbo-scenarios |
| `set-watchlist` | — | WatchlistEntry | deals |
| `create-annotation` / `update-annotation` | — | Annotation | annotations |

Writes go through a **separate write engine**; the read engine is opened with `file:…?mode=ro&uri=true`, so a read route physically cannot write. Seeded tables have no command that targets them (enforced by a test that walks `COMMANDS` and asserts each handler only touches tables in `WRITABLE_TABLES`).

### 5.3 Jobs (one pipeline for every LLM/agent task)

```
POST /api/commands/screen-teaser {text}
  → Job(status=queued, kind=teaser_screen) written, 202 returned with job
  → JobRunner.start(job) → POST agent /workflows/{kind}/start {jobId, input}
  ← agent POST /internal/jobs/{id}/progress {step, message}     (repeated)
  ← agent POST /internal/jobs/{id}/result   {payload}
  → payload validated against the kind's Pydantic schema
  → kind's persist() writes rows in one transaction
  → Job(status=succeeded, result_ref=…)
  → SSE: {type:"changed", resources:["deals","jobs"], ids:[…]}
```

`JobKind` registry = `{kind: (input_schema, result_schema, persist_fn, invalidates)}`. Adding a new agent capability is one registry entry plus one Mastra workflow. Failures set `status=failed` with an error; jobs time out after a configured limit.

### 5.4 Live updates

`GET /api/events` is a single SSE stream. The event bus (in-process `asyncio` fan-out) publishes `changed` events after every committed write and `job` events on progress. One stream per browser tab; no polling.

---

## 6. Data model (data classes)

All money in **£m** as `Decimal`, rates as fractions, multiples as plain floats. IDs are ULIDs. Every table has `created_at`; writable tables also have `source` (`seed` | `user` | `agent`).

**Reference / fund (seeded, read-only)**

| Class | Key fields |
|---|---|
| `Fund` | name, vintage, committed, mandate (ebitda_min/max, irr_hurdle, max_leverage, hold_years) |
| `Benchmark` | key, label, low, high, unit, source_note — leverage bands, coverage floors, hurdle IRRs, concentration limits |
| `MacroRate` | key (SONIA…), value, as_of |
| `ScreeningCriterion` | key, label, weight, target_text, scoring params (floor, ceiling) — **weights live in data, not code** |

**Market (seeded + agent-written)**

| Class | Key fields |
|---|---|
| `Segment` | name, short, market_size, cagr, avg_margin, fragmentation, ai_exposure, median_multiple, addon_multiple, typical_leverage, deal_count_24m, view, white_space |
| `SegmentAttributeScore` | segment_id, attribute (non-cyclical…), score 0–3 |
| `ExitRouteMix` | segment_id, strategic_pct, sponsor_pct, ipo_pct |
| `Transaction` | date, target, acquirer, segment_id, ev, ev_ebitda, route |
| `ResearchReport` *(agent)* | segment_id?, question, summary, status, model, created_at |
| `ResearchFinding` *(agent)* | report_id, metric, value, unit, period, confidence, source_ids |
| `Source` *(agent)* | url, title, publisher, retrieved_at, excerpt |

**Deals (seeded + user/agent-written)**

| Class | Key fields |
|---|---|
| `Company` | name, description, hq, segment_id, ownership, moat |
| `Deal` | company_id, code_name, stage (Teaser…SPA), process, ask_multiple, origin (`seed`/`teaser`) |
| `DealFinancials` | deal_id, revenue, ebitda, growth, recurring_pct, capex_pct, da_pct, nwc_pct, top_customer_pct, gross_retention, cyclicality, ai_resilience, fragmentation, key_person_risk |
| `RiskFlag` | deal_id, severity, text, mitigant |
| `DiligenceQuestion` | deal_id, text |
| `Teaser` *(user)* | raw_text, job_id, deal_id |
| `WatchlistEntry` *(user)* | deal_id, note |
| `LboScenario` *(user)* | deal_id, name, assumptions (JSON validated by `LboAssumptions`) |
| `Memo`, `MemoSection` *(agent)* | deal_id, scenario_id, section key, markdown, status |

**Portfolio (seeded, read-only)**

| Class | Key fields |
|---|---|
| `PortfolioCompany` | company_id, invest_year, invested, fair_value, revenue, ebitda_ltm, ebitda_budget, net_leverage, status |
| `KpiPoint` | company_id, metric, period, value (quarterly EBITDA, budget…) |
| `DebtFacility` | company_id, type, pricing, covenant, test_level, actual, interest_cover, cov_lite |
| `ValueCreationItem` | company_id, lever, amount |
| `FundCashflow` | period, calls, distributions, nav |
| `ExitPlan` | company_id, route, buyers, window |
| `Alert` | company_id, severity, label, text, action |

**System (writable)** — `Job` (kind, status, input, progress[], result_ref, error), `Annotation` (route, selector, rect, viewport, note, status, screenshot_path).

**Computed (never stored)** — `ScreeningResult`, `CriterionScore`, `RiskCheck`, `DebtCapacity`, `LboResult`, `Grid`, `RangeSeries`, `Bridge`.

Mock data: ~8 pipeline deals, 7 segments, 6 platforms, 8 quarters of KPIs, ~40 transactions, 10 years of fund cash flows. All names fictional. Seed is deterministic so tests can assert exact numbers.

---

## 7. Frontend — `apps/web`

### 7.1 Layout

```
src/
├── app/
│   ├── layout.tsx                    AppShell (Sidebar, Header), providers
│   ├── page.tsx                      Overview
│   ├── markets/page.tsx · markets/[segment]/page.tsx
│   ├── research/page.tsx
│   ├── deals/page.tsx · deals/new/page.tsx
│   ├── deals/[id]/layout.tsx         deal header + Overview · Model · IC memo tabs
│   ├── deals/[id]/page.tsx · deals/[id]/model/page.tsx · deals/[id]/memo/page.tsx
│   ├── portfolio/page.tsx · portfolio/[id]/page.tsx · portfolio/covenants/page.tsx
│   ├── exits/page.tsx
│   ├── fund/page.tsx
│   └── dev/components/page.tsx       component gallery (dev only)
├── components/
│   ├── ui/                           primitives (§7.3)
│   ├── charts/                       chart wrapper + typed chart components
│   └── domain/                       compositions of ui + charts, data passed as props
├── features/
│   └── feedback/                     annotation overlay (§9)
├── hooks/                            useResource, useCommand, useLiveEvents, useUrlState, useDebounced
├── lib/
│   ├── api/                          client.ts, registry.ts, generated types (re-export of contracts)
│   └── format.ts                     money, multiple, pct, bp, date — pure functions
└── styles/tokens.css                 design tokens (design doc §2)
```

**Layering rule:** `ui` imports nothing above it; `charts` imports `ui`; `domain` imports `ui` + `charts` and **receives data via props** (no hooks); pages are the only place hooks are called. This keeps every component testable and gallery-renderable with fixture props.

### 7.2 Hooks — the whole data layer

Built on TanStack Query. The registry maps typed keys to endpoints, so components never see URLs.

```ts
// lib/api/registry.ts — the only place endpoints are named
export const resources = {
  segments:            { path: '/segments' },
  deals:               { path: '/deals' },
  deal:                { path: '/deals/{id}' },
  portfolioCompanies:  { path: '/portfolio-companies' },
  kpiSeries:           { path: '/kpi-series' },
  alerts:              { path: '/alerts' },
  fund:                { path: '/fund' },
  fundCashflows:       { path: '/fund-cashflows' },
  transactions:        { path: '/transactions' },
  researchReports:     { path: '/research-reports' },
  job:                 { path: '/jobs/{id}' },
  annotations:         { path: '/annotations' },
  lbo:                 { path: '/compute/lbo', method: 'POST' },
  lboSensitivity:      { path: '/compute/lbo-sensitivity', method: 'POST' },
  debtCapacity:        { path: '/compute/debt-capacity', method: 'POST' },
} as const satisfies Record<string, ResourceDef>;

export const commands = {
  screenTeaser: '/commands/screen-teaser',
  startMarketResearch: '/commands/start-market-research',
  draftMemo: '/commands/draft-memo',
  saveScenario: '/commands/save-scenario',
  setWatchlist: '/commands/set-watchlist',
  createAnnotation: '/commands/create-annotation',
  updateAnnotation: '/commands/update-annotation',
} as const;
```

| Hook | Signature | Notes |
|---|---|---|
| `useResource` | `useResource<K>(key: K, params?: ParamsOf<K>, opts?) → { data, isLoading, error, refetch }` | Handles GET list/detail **and** POST compute. Types inferred from the generated OpenAPI types. `opts.debounceMs` for slider-driven compute; `opts.keepPrevious` to avoid flicker. |
| `useCommand` | `useCommand<K>(key: K) → { run(input), status, result, job }` | The single write hook (R4). If the response is a `Job`, it tracks it via `useResource('job', {id})` until terminal. Invalidation is driven by server events, not hard-coded in the hook. |
| `useLiveEvents` | `useLiveEvents()` — mounted once in the provider | Opens `/api/events`; on `changed` it invalidates matching resource keys; on `job` it patches the job cache. Exposes `recentlyChanged(ids)` for row-flash animation. |
| `useUrlState` | `useUrlState<T>(name, default, codec?)` | Filters, case, chart selection. Entities live in the route (`/deals/[id]`); the URL is the UI state store — shareable, nothing persisted locally. |
| `useDebounced` | `useDebounced<T>(value, ms)` | Shared by sliders and search inputs. |

Example — two pages, one hook:

```ts
const deals = useResource('deals', { verdict: filter });            // pipeline table
const kpis  = useResource('kpiSeries', { company_id, metric: 'ebitda' }); // portfolio chart
const lbo   = useResource('lbo', assumptions, { debounceMs: 150, keepPrevious: true });
const screen = useCommand('screenTeaser');  // screen.run({ text }) → job → new deal appears live
```

### 7.3 Component inventory (defined once, imported everywhere)

**`ui/` primitives** — Radix UI underneath for accessibility; styled with tokens.

Shell and layout: `AppShell` · `Sidebar` · `Breadcrumb` · `PageHeader` · `PageSection` · `OnThisPage` · `StatStrip`.

`Button` (variant: primary/secondary/ghost/danger, size: sm/md, loading) · `IconButton` · `SegmentedControl` (filters, cases) · `Tabs` · `Badge` (tone: neutral/accent/good/warn/bad) · `StatusDot` · `Card` (header slot, actions slot, padding) · `SectionHeader` · `Stat` (label, value, delta, hint; used for every KPI tile) · `StatGroup` · `KeyValueList` · `DataTable<Row>` (column defs, sort, row select, sticky header, numeric alignment, row flash, empty/loading/error) · `Slider` (label, formatter, min/max/step, hint, marks) · `NumberField` · `Select` · `Combobox` · `Textarea` · `Checkbox` · `Tooltip` · `Dialog` · `Drawer` · `Toast` · `Skeleton` · `EmptyState` · `ErrorState` · `ProgressSteps` (job progress) · `ScoreBar` · `HeadroomMeter` · `DotRating` · `Callout`/`AlertItem` (alert rows) · `Markdown` (memo/report rendering).

**`charts/`** — one `Chart` wrapper owns library setup, theming from tokens, resize, reduced-motion, tooltip formatting and the accessible table fallback. Typed components are thin option-builders on top:

`BarChart` (horizontal|vertical, grouped, optional target markers — EBITDA vs budget, funnel, multiple arbitrage) · `StackedBarChart` (100% mode — exit routes) · `WaterfallChart` (value-creation, equity bridge) · `LineChart` (area option — J-curve) · `ScatterChart` (bubble size — growth vs margin) · `HeatmapGrid` (IRR sensitivity) · `RangeBarChart` (football-field valuation) · `Sparkline`.

**`domain/`** — e.g. `PipelineTable`, `DealScorecard`, `RiskChecklist`, `DebtCapacityPanel`, `TeaserIntake`, `AlertList`, `CovenantTable`, `PlatformTable`, `LboAssumptionsPanel`, `SourcesUsesTable`, `DebtScheduleTable`, `MemoComposer`, `SegmentProfile`, `ResearchPanel`, `ReportCard`, `JobStatus`. Each is a composition of the above — no new styling primitives.

### 7.4 Charting library — Decision D1: **ECharts** (chosen)

| Option | Strengths | Weaknesses |
|---|---|---|
| **Apache ECharts** (`echarts` + thin React wrapper) — *recommended* | Widely used in finance dashboards; every chart we need is native (waterfall via stacked bar, bubble scatter, heatmap, funnel, range bars); canvas, fast; themeable from tokens; Apache-2.0 | Option objects are verbose (mitigated by our builders) |
| AG Charts Community | Built for financial apps, pairs with AG Grid; strong typing | Waterfall, heatmap, range-bar are **Enterprise (paid)** |
| Recharts | Most popular in React; declarative JSX | Waterfall/heatmap need hand-rolling; SVG slows on large sets |
| TradingView Lightweight Charts | Industry standard for price/time series | Time series only — no scatter, waterfall, heatmap |
| visx (Airbnb) | Total control, D3 primitives | We'd build every chart ourselves — most code to own |

Tables: **TanStack Table** (headless, MIT) under `DataTable` — fits our tokens and needs no licence. AG Grid Community is the alternative if spreadsheet-style editing becomes a requirement.

---

## 8. Agent service — `apps/agent` (Mastra)

### 8.1 Layout

```
src/
├── mastra/index.ts              Mastra instance, server (Hono), auth middleware (service token)
├── llm.ts                       Anthropic SDK (`callClaude`); one model from env (see 05-agent-cost-design.md)
├── agents/
│   ├── marketResearcher.ts      autonomous: plans, searches, reads, extracts, cites
│   └── analyst.ts               structured extraction / drafting (teasers, memo sections)
├── workflows/                   one per JobKind; each step reports progress to the API
│   ├── teaserScreen.ts          extract → validate ranges → classify segment → flags & questions
│   ├── marketResearch.ts        plan queries → search → read → extract findings → synthesise → cite
│   └── memoDraft.ts             per-section drafting from deal + LBO result
├── tools/                       hand-made tools, each with Zod input/output
│   ├── webSearch.ts             provider adapter — Tavily (D2); one interface, swappable backends
│   ├── fetchPage.ts             fetch + readability extraction, size-capped, robots-aware
│   ├── extractTables.ts         HTML/PDF tables → rows
│   ├── companyRegistry.ts       UK Companies House lookup (filings, officers, accounts)
│   ├── secFilings.ts            SEC EDGAR full-text search (listed comps)
│   ├── fxRates.ts               ECB reference rates (normalise to £)
│   ├── internalData.ts          read-only calls to our API (segments, deals, transactions) for context
│   ├── calculator.ts            CAGR, multiples, unit conversion — no LLM arithmetic
│   └── recordSource.ts          registers a citation; findings must reference recorded sources
├── queries/                     parameterised search-query templates
│   └── marketSize.ts, dealComps.ts, sponsorActivity.ts, regulation.ts, aiDisruption.ts
├── skills/                      markdown playbooks composed into agent instructions
│   └── sizing-a-market.md, finding-deal-comps.md, pe-screening-criteria.md, citing-sources.md
└── callbacks.ts                 progress/result POSTs back to the API
```

### 8.2 Contract and guardrails

- Workflow inputs/outputs use the **Zod schemas generated from OpenAPI** (`packages/contracts/schemas.ts`) — the agent cannot invent shape.
- Every numeric finding must carry ≥1 `source_id` recorded via `recordSource`; the API rejects uncited findings.
- Arithmetic goes through `calculator`, never free-text LLM maths.
- Budgets per job: per-call `max_tokens`, wall-clock timeout — configured in env.
- Anthropic direct, `claude-haiku-5-5` at effort `medium`, set via env (`MODEL`, `EFFORT`, `TOOL_CACHE_HOURS`) so they can change without code changes. See `docs/05-agent-cost-design.md`.

---

## 9. Feedback annotation tool

Built immediately after sign-off, before page work, so it is available from the first visible screen.

- Floating toggle (bottom-right) + shortcut `Shift+F` → crosshair mode → click any element → popover with a note field.
- Captures route, query string, a stable CSS selector (prefers `data-testid`), element rect, viewport size, theme, and an html2canvas crop of the element.
- Saved through `useCommand('createAnnotation')` — the same write pipeline as everything else.
- Pins render over the page at their element; a side drawer lists open/resolved notes.
- I read open annotations via `GET /api/annotations?status=open`, fix, and mark them resolved.

---

## 10. Testing strategy and TDD workflow

### 10.1 Test stack

| Layer | Tooling | What is tested |
|---|---|---|
| API services | pytest | Screening score/verdict, LBO engine (golden numbers vs a hand-checked spreadsheet), credit, portfolio bridges |
| API routes | pytest + httpx | Every `ResourceSpec`, `ComputeSpec`, `CommandSpec`; read engine refuses writes; seeded tables unwritable |
| Jobs | pytest + fake agent | Full job lifecycle; invalid / uncited agent payloads rejected; SSE events emitted |
| Agent | Vitest | Tools against recorded fixtures (no live network); workflows with a mocked LLM; schema conformance |
| Web hooks | Vitest + MSW | `useResource` typing/caching/debounce; `useCommand` job tracking; `useLiveEvents` invalidation |
| Web components | Vitest + Testing Library | Each primitive's behaviour and a11y (roles, keyboard) |
| Visual | Playwright | Screenshot of every gallery entry, light + dark, 1440 and 390 widths; each page |
| E2E | Playwright | Screen a teaser → job → new deal appears live; slider → LBO updates; research job → report renders |
| Contract | `make codegen` diff | Frontend/agent types in sync with backend |

### 10.2 Working loop for each unit of work

1. I write the tests for the unit (and fixtures/gallery stories) and run them — **confirm they fail** for the right reason.
2. `make snapshot-tests` → writes `scripts/.test-snapshot.json` (SHA-256 of every file under `**/tests/**`, `**/*.test.ts(x)`, `**/*.spec.ts`, Playwright baselines).
3. Dispatch a subagent (Sonnet 5.5, medium effort) with: the failing test list, the files it may touch, these two documents, and the rule *"do not create, edit, or delete any test file."*
4. On return: `make verify-tests` compares hashes — any test change ⇒ work rejected and redone. Then run the full suite + lint + typecheck myself.
5. Visual check in the browser against the gallery / page, then mark done.

Test files are additionally protected by a pre-commit hook during subagent runs.

---

## 11. Decisions (resolved 25 Oct 2026)

| ID | Decision | Outcome |
|---|---|---|
| D1 | Charting library | **Apache ECharts** + TanStack Table |
| D2 | Agent web-search provider | **Tavily**, behind the `webSearch` adapter so it can be swapped |
| D3 | Where LLM calls live | **All in the Mastra service**, calling Anthropic directly (`claude-haiku-5-5`, effort medium; see `05-agent-cost-design.md`); FastAPI never calls the model |
| D4 | LBO maths location | **Backend** compute endpoint, debounced 150 ms from sliders, **results cached** (see below) |
| D5 | Auth | None for v1 (single-user local tool); structure leaves room for it — *still open, defaulting to none* |

**D4 caching.** Compute endpoints are pure functions of (inputs, data version), so the result is cached at two levels:
- *Server*: `ComputeSpec` wraps the handler in a bounded LRU cache keyed by `sha256(canonical JSON of input) + data_version`. `data_version` increments on any committed write that affects the deal, so stale results can't be served.
- *Client*: `useResource` uses the canonical input as the query key with a long `staleTime`, so returning to a slider position you've already used is instant and makes no request. This is an in-memory request cache, not stored data, so it complies with R1.

## 12. Environment and prerequisites

This machine currently has Python 3.9 and no Node. Required: **Node 22 LTS + pnpm**, **Python 3.12 via uv**, and keys in `.env`: `ANTHROPIC_API_KEY`, `SEARCH_API_KEY`, `AGENT_SERVICE_TOKEN`. `make dev` starts api (:8000), agent (:4111) and web (:3000).

## 13. Build order after sign-off

1. Toolchain, monorepo skeleton, CI scripts, test-snapshot tooling
2. DB models + seed + generic repository/router/command/job plumbing (API)
3. Contracts codegen → `useResource` / `useCommand` / `useLiveEvents`
4. Design tokens + all `ui/` primitives + `charts/` + `/dev/components` gallery
5. **Feedback annotation tool**
6. App shell and Overview → Pipeline, Screen a teaser, Deal overview → Deal model and IC memo → Markets, Segment, Research → Portfolio, Platform, Covenants → Exits, Fund performance (domain components first, then each page)
7. Agent service: tools → teaser workflow → research workflow → memo workflow
8. E2E pass, visual baselines, feedback rounds
