# Implementation plan

Derived from the approved `01-architecture-proposal.md` (§4–§10, §13 build order) and `02-design-system.md` (§3 site map, §5 pages, §6 components). Every step follows the same loop:

1. **Test first.** I write the tests and confirm they fail for the right reason.
2. **Lock.** `scripts/test_lock.py snapshot <step>` hashes every test file.
3. **Build.** A subagent (Sonnet 5.5, medium effort) implements the step without touching tests.
4. **Verify** (I do this myself, never on the subagent's word):
   - the test lock shows no changed or removed tests;
   - the full suites pass: `make test-api`, web `vitest`;
   - lint and type checks are clean: ruff, `tsc`;
   - `make codegen-check` passes;
   - `make smoke-web` passes;
   - for anything visible, the page is checked in the browser in light theme at 1440px, and fixes found there get new tests first.
5. **Tick** the box here, with the date.

Status at last audit: **25 Oct 2026**. ☑ done and verified · ☐ to do · ⧗ deferred by product owner.

---

## Phase 0 — Foundations
- [x] 0.1 Toolchain in the home folder: Node 22, pnpm, Python 3.12, uv
- [x] 0.2 Monorepo layout (`apps/api`, `apps/web`, `apps/agent`, `packages/contracts`), Makefile, `.env.example`, git init
- [x] 0.3 Test lock script (named snapshots); coding standards (`03-coding-standards.md`)
- [x] 0.4 Route smoke check (`make smoke-web`)

## Phase 1 — Backend platform (arch §5)
- [x] 1.1 Data classes: every table in arch §6
- [x] 1.2 Deterministic mock seed (`make seed`)
- [x] 1.3 Read-only engine; write guard (writable tables only, seed rows immutable)
- [x] 1.4 Generic `Repository[T]`, `ResourceSpec` registry, router factory, error shape
- [x] 1.5 `CommandSpec` registry and the command router (annotations, market research)
- [x] 1.6 Event bus and the SSE `/api/events` stream (checked live)
- [x] 1.7 Job pipeline: `JobKindSpec`, runner, `AgentClient`, internal callbacks with the service token
- [x] 1.8 Settings with `.env` names, CORS for the web app

## Phase 2 — Domain services and API wiring (arch §5.1–5.2)
- [x] 2.1 Screening scorecard and risk checks (criteria and weights read from the database)
- [x] 2.2 Debt capacity and covenant headroom
- [x] 2.3 LBO engine: sources and uses, schedule, returns, credit stats, bridge, cases, sensitivity, max bid
- [x] 2.4 Fund maths: IRR, TVPI, DPI, J-curve series
- [x] 2.5 Enriched reads: deals, portfolio companies, funds, alerts and other company joins; computed filters and sorts
- [x] 2.6 Compute endpoints (`lbo`, `lbo-sensitivity`, `debt-capacity`) with the D4 cache
- [x] 2.7 Pipeline summary endpoint
- [x] 2.8a `set-watchlist` command + `watchlisted` on deals — 25 Oct
- [x] 2.8b `save-scenario` command + `lbo-scenarios` read — 25 Oct
- [x] 2.9 Excel LBO export (`/api/exports/lbo`, openpyxl, from the same engine) — 25 Oct; plus the `valuation-range` compute
- [x] 2.10 Market and portfolio read helpers the pages need: segment detail (transactions, players, matching deals), exit-route mix, fund cash-flow table — 25 Oct; plus portfolio/covenant/exit/market/overview summaries, distribution waterfall, and fund metrics as of the valuation date

## Phase 3 — Contract (arch §4)
- [x] 3.1 Every route publishes a named, typed OpenAPI schema
- [x] 3.2 `make codegen` and `codegen-check` produce `packages/contracts/src/openapi.ts`
- [x] 3.3 Web types are derived from the contract (`ResourceData`, `CommandInput`, …)
- [x] 3.4 Tighten hook input types: fix the loose early tests, then remove the `Partial<…>` inputs — 25 Oct
- [ ] 3.5 Zod schemas for the agent, generated from the same OpenAPI document

## Phase 4 — Web foundation (arch §7, design §2, §4, §6–§8)
- [x] 4.1 Design tokens (light and dark wired; dark polish ⧗) and global styles
- [x] 4.2 Data layer: `apiFetch`, registry, `ApiProvider`, `useResource`, `useCommand`, live events, `useDebounced`, `fmt`
- [x] 4.3 UI primitives built so far: Button, Badge, SegmentedControl, Tabs, Slider, TextField/Textarea, Stat/StatStrip, Card, DataTable, ScoreBar, HeadroomMeter, DotRating, KeyValueList, AlertItem, ProgressSteps, Empty/Error/Skeleton, Breadcrumb, PageHeader, PageSection, Sidebar
- [x] 4.4 Charts: one `Chart` wrapper, theme hook, option builders (bar, stacked, waterfall, line, scatter, heatmap, range bar), checked in real ECharts and the browser
- [x] 4.5 App shell: sidebar in lifecycle order, breadcrumbs, jobs indicator, theme toggle, 14 routes
- [x] 4.6 Component gallery `/dev/components`
- [ ] 4.7 Remaining primitives from arch §7.3 (built when their first page needs them; each added to the gallery):
  - `useUrlState` (Pipeline)
  - ~~OnThisPage~~ (done with 6.2); Select, Tooltip when first needed
  - NumberField, Toast (Model)
  - Dialog/Drawer, Checkbox, Markdown (Memo)
  - Combobox, Sparkline (Markets/Portfolio)

## Phase 5 — Feedback tool (arch §9, design §10)
- [x] 5.1 Overlay: toggle, Shift+F, banner, capture, pins, notes drawer, resolve — saved through `useCommand`, checked end to end in the browser

## Phase 6 — Pages (design §5), in lifecycle order where dependencies allow
Each page gets domain components (props only), a view that calls hooks, page tests with mocked API, then browser review.
- [x] 6.1 **Pipeline** `/deals`: summary strip · deals table with verdict filter in the URL · flow charts — 25 Oct
  - Browser review fixes: score sort, Pass tone, gate reason in the row, integer and complete chart axes; API reload hang (SSE streams now close on shutdown) and request timeouts
- [x] 6.2 **Deal overview** `/deals/[id]`: deal header and tabs · snapshot · scorecard · risks and flags · debt capacity · diligence questions · watchlist — 25 Oct
  - Browser review fixes: seeded criteria targets now describe what is scored; warning when policy leverage exceeds stressed capacity; no duplicate scorecard description
- [x] 6.3 **Deal model** `/deals/[id]/model`: returns strip · assumptions sliders (debounced, cached compute) · sources and uses · credit profile · projections · sensitivity heatmap · valuation range · value bridge · save scenario · Excel export — 25 Oct
  - Browser review fixes: formatted waterfall labels, placeholders while loading, ask stated on the valuation chart, benchmark captions
- [ ] 6.4 **Portfolio** `/portfolio`: summary · platforms table · EBITDA vs budget · value creation
- [ ] 6.5 **Platform** `/portfolio/[id]`: snapshot · quarterly performance · capital structure · value creation · alerts · exit plan
- [ ] 6.6 **Covenants** `/portfolio/covenants`: headroom summary · covenant monitor · test calendar
- [ ] 6.7 **Exits** `/exits`: readiness summary · exit planner · exit routes by segment
- [ ] 6.8 **Fund performance** `/fund`: returns strip · J-curve · distribution waterfall · cash-flow table
- [ ] 6.9 **Markets** `/markets`: summary · growth vs margin · sponsor attractiveness · valuation charts
- [ ] 6.10 **Segment** `/markets/[segment]`: profile · landscape and transactions · evidence
- [ ] 6.11 **Overview** `/`: fund at a glance · needs attention · Copilot activity
- [ ] 6.12 **Screen a teaser** `/deals/new`: needs 7.4
- [ ] 6.13 **Research** `/research`: needs 7.5
- [ ] 6.14 **IC memo** `/deals/[id]/memo`: needs 7.6

## Phase 7 — Agent service (arch §8) — **needs OpenRouter and Tavily API keys from you before 7.4**
- [ ] 7.1 Mastra server scaffold (Node), OpenRouter provider, models per role from env, service-token auth, `/jobs/{kind}/start`
- [ ] 7.2 Tools, each with Zod I/O and recorded-fixture tests (no live network in tests): webSearch (Tavily adapter), fetchPage, extractTables, companyRegistry (Companies House), secFilings (EDGAR), fxRates (ECB), internalData (read-only API), calculator, recordSource
- [ ] 7.3 Query templates and skill playbooks
- [ ] 7.4 `teaserScreen` workflow + API `screen-teaser` command and persist (new deal appears live)
- [ ] 7.5 `marketResearch` workflow (cited findings; uncited rejected by API); `confidence` becomes a string enum (TODO.md)
- [ ] 7.6 `memoDraft` workflow + API `draft-memo` command and persist
- [ ] 7.7 Budgets and guardrails: tool-call, token and time limits; progress callbacks

## Phase 8 — Quality
- [ ] 8.1 Playwright E2E: screen a teaser → job → deal appears live; slider → LBO updates; research job → report renders; feedback note round trip
- [ ] 8.2 Visual baselines: gallery and each page, light theme, 1440px and 390px
- [ ] 8.3 Accessibility pass (keyboard, focus, contrast, table views for charts)
- [ ] 8.4 Rounds of fixes from your feedback notes
- [ ] 8.5 ⧗ Dark-mode rework (deferred by product owner)
