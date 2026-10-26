# Harrowgate Deal Copilot — Design System

Status: **APPROVED** 25 Oct 2026 · Version 0.3

> **TODO (deferred by product owner):** dark mode will be reworked later. Build against the dark tokens in §2.1 for now so the switch works end to end, but don't polish dark-only details until the rework is scheduled.
Binding for every session that builds UI. If something is not covered here, use an existing component; if none fits, raise it before building.
Visual reference: `docs/preview/theme-preview.html` (mock data only).

---

## 1. Principles

1. **Numbers first.** Figures are the content. Large, aligned, consistently formatted; prose supports them.
2. **One way to do each thing.** Every visual element comes from `components/ui` or `components/charts`. No page-local styling beyond layout.
3. **Calm by default, loud only for exceptions.** Colour follows the 70-20-10 rule (§2.1). Royal blue is for highlights, status colour is for exceptions, and muted grey is for everything secondary.
4. **Institutional, not decorative.** It should read like a bank's research note: white space, hairline rules, no gradients, no glow, no illustrations.
5. **Slick through restraint.** Prefer hairlines over boxes, one surface over nested cards, and sentence case over uppercase. Use small radii and quiet shadows.
6. **The site tells one story.** Navigation follows the fund's lifecycle (§3). Every page answers one question, and its sections run from summary to detail.
7. **Explain the number.** Every score, verdict and flag has a hover or inline reason and, where it comes from a benchmark, the benchmark name.

---

## 2. Tokens (`styles/tokens.css`)

All values are CSS custom properties on `:root`, redefined for dark under `[data-theme="dark"]` and `prefers-color-scheme: dark` (unless `data-theme="light"`). Theme follows the OS; a toggle in the sidebar footer overrides it. Components reference tokens only — **no raw hex in components**.

### 2.1 Colour — UI

**70-20-10 rule**

| Share | Role | Light mode | Dark mode |
|---|---|---|---|
| **70%** dominant | Page, cards, tables | **White** | **Midnight royal** (very dark, low-saturation blue) |
| **20%** secondary | Text, rules, headers, sidebar, muted grey for comments and less important information | Navy ink + cool greys | Off-white ink + slate-blue greys |
| **10%** accent | Primary buttons, selection, active nav, links, focus, the headline figure | **Royal blue** | **White** (navy text on white buttons) |

Status colours (good / warn / bad) sit **outside** the 70-20-10 split and appear only on exceptions. Dark mode is the inverse of light: the royal hue darkens to near-black and becomes the ground, and white becomes the accent. Dark mode deliberately carries **less saturation** than light mode, so it reads as dark navy rather than as blue.

**Light (default)**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FFFFFF` | Page plane |
| `--surface` | `#FFFFFF` | Cards, tables — separated by hairlines, not by tint |
| `--surface-sunk` | `#F7F8FB` | Sidebar, segmented-control track, input wells, hover rows |
| `--surface-raised` | `#FFFFFF` | Popovers, dialogs, drawer (with shadow) |
| `--line` | `#E6E9F0` | Hairline borders, dividers, gridlines |
| `--line-strong` | `#D0D6E0` | Input borders, axis baseline, header rule |
| `--ink` | `#0B1B3F` | Primary text and figures (16.9:1) |
| `--ink-2` | `#3F4A5C` | Labels, secondary text (9.0:1) |
| `--ink-3` | `#656D7A` | **Muted grey**: comments, hints, footnotes, timestamps, axis ticks, table headers (5.2:1 on white, 4.7:1 on `--accent-soft`) |
| `--accent` | `#1F45C8` | **Royal blue** (7.7:1) |
| `--accent-hover` | `#1838A6` | Hover/pressed |
| `--accent-ink` | `#FFFFFF` | Text on accent |
| `--accent-soft` | `#EEF2FD` | Selected row, active nav item, live-update flash |
| `--link` | `#1F45C8` | Links, citations |
| `--good` / `--good-soft` | `#11734A` / `#EAF5EF` | Advance, on track, clear |
| `--warn` / `--warn-soft` | `#9A5B00` / `#FBF3E2` | Watch, behind budget |
| `--bad` / `--bad-soft` | `#B42330` / `#FBECEC` | Pass, breach, action |
| `--input` | `#1F45C8` | Editable model inputs (finance convention: blue = input) |

**Dark**

| Token | Value | Use |
|---|---|---|
| `--bg` | `#070E26` | Page plane — midnight royal |
| `--surface` | `#0B1636` | Cards, tables |
| `--surface-sunk` | `#060C20` | Sidebar, tracks, input wells |
| `--surface-raised` | `#0E1B40` | Popovers, dialogs, drawer |
| `--line` | `#1C2A52` | Hairlines, gridlines |
| `--line-strong` | `#2A3A68` | Input borders, axis baseline |
| `--ink` | `#E7ECF7` | Primary text and figures (15.0:1) |
| `--ink-2` | `#AFBAD3` | Labels, secondary text (9.1:1) |
| `--ink-3` | `#7F8BAA` | **Muted slate**: comments, hints, axis ticks (5.2:1) |
| `--accent` | `#FFFFFF` | Primary button fill, active nav marker, selected-row bar, focus ring |
| `--accent-hover` | `#E3E9F7` | Hover/pressed |
| `--accent-ink` | `#0B1B3F` | Navy text on white buttons |
| `--accent-soft` | `rgb(255 255 255 / 0.06)` | Selected row, active nav item, live-update flash |
| `--link` | `#9DB8F2` | Links, citations (8.9:1) |
| `--good` / `--good-soft` | `#4DBF8B` / `rgb(77 191 139 / 0.12)` | |
| `--warn` / `--warn-soft` | `#E0B25A` / `rgb(224 178 90 / 0.12)` | |
| `--bad` / `--bad-soft` | `#EE8A8E` / `rgb(238 138 142 / 0.12)` | |
| `--input` | `#9DB8F2` | Editable model inputs |

`--focus-ring`: `0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent)` in both modes. Every text token clears WCAG AA on its surfaces. Status colours always come with a label or icon, never colour alone.

**Where the accent is allowed**, and nowhere else: the primary `Button`, the active nav item, the selected-row bar, `Slider` thumb and fill, the focus ring, links, the single headline figure in a stat strip, and chart series 1. If a light screen looks more than about 10% blue, something that should be grey is using the accent.

### 2.2 Colour — data visualisation

Assigned to entities in a fixed order, never cycled or re-ranked. Dark-mode series are **desaturated** to match the muted ground.

| Slot | Light (on white) | Dark (on midnight) |
|---|---|---|
| `--series-1` royal | `#1F45C8` | `#7FA2EC` |
| `--series-2` orange | `#E8692E` | `#E99A6E` |
| `--series-3` teal | `#13A06F` | `#4DBF9E` |
| `--series-4` amber | `#B98200` | `#D9B562` |
| `--series-5` rose | `#D9608F` | `#D68BAA` |
| `--series-other` grey | `#8A94A6` | `#8D98B5` |

- **Sequential**: light `#EEF2FD → #1F45C8 → #0B1B3F`; dark `#0E1B40 → #7FA2EC → #E7ECF7`.
- **Diverging** (IRR vs hurdle, variance): light `#B42330 ← #F1F2F5 → #1F45C8`; dark `#B8646A ← #1C2A52 → #6F8FD6` (deliberately low-chroma).
- Comparison series (budget, prior period, benchmark) use `--series-other`, so the accent stays on the figure that matters.
- Caps: bubble/scatter charts use at most 3 colours; bars and lines use at most 5 plus "Other".
- Every slot clears 3:1 on its surface. The colour-blindness separation check runs during setup, and any failing slot is re-stepped.

### 2.3 Typography

| Family | Used for |
|---|---|
| **Source Serif 4** (600) | Page titles, IC memo headings — nothing else |
| **IBM Plex Sans** (400 / 500 / 600) | All UI, tables, figures, charts |
| **IBM Plex Mono** (400) | Deal code names, IDs, formulas, mandate strip |

| Role | Font | Size / line | Weight | Notes |
|---|---|---|---|---|
| Page title | Serif | 28 / 36 | 600 | One per page |
| Section title | Sans | 16 / 24 | 600 | Sentence case; optional one-line description in `--ink-3` beneath |
| Card title | Sans | 14 / 20 | 600 | Sentence case |
| Eyebrow / table header / stat label | Sans | 11 / 16 | 500 | Uppercase, tracking +0.06em, `--ink-3` — the **only** uppercase |
| Body | Sans | 14 / 22 | 400 | |
| Table cell | Sans | 13 / 20 | 400 | Numbers tabular, right-aligned |
| Caption / comment | Sans | 12 / 16 | 400 | `--ink-3` |
| Stat value | Sans | 22 / 30 | 500 | Headline stat 28 / 36 in `--accent` |
| Memo H1 / H2 | Serif | 24 / 32 · 18 / 26 | 600 | IC memo only |

No italics except in memo quotations. Use at most two weights per card. The serif never appears in charts.

### 2.4 Number formatting (`lib/format.ts` — the only formatter)

| Kind | Format | Example |
|---|---|---|
| Money | `£` + 1 dp + unit | `£14.6m`, `£1.4bn` |
| Multiple | 1 dp + `x` (2 dp for MOIC) | `15.5x`, `2.52x` |
| Percent | 1 dp (0 dp in dense tables) | `20.3%` |
| Basis points | signed integer + `bp` | `+50bp` |
| Negatives | parentheses in financial tables, minus elsewhere | `(6.2)` |
| Zero / n.a. | en dash | `–` |
| Dates | `25 Oct 2026`; quarters `Q3 26` | |

### 2.5 Spacing, size, shape

- **Base unit 4px.** Scale `4, 8, 12, 16, 20, 24, 32, 40, 48, 64` → `--space-1 … --space-10`.
- Card padding **20px** (16px below 768px). Gap between cards **16px**. Gap between page sections **48px**, with a hairline `--line` above each section after the first.
- Table rows **44px** (compact 36px); cell padding 16px horizontal at the card edge, 12px between cells.
- Controls: **32px** default height, 28px small, 40px large (page-level primary only).
- Radius: **6px** controls, **4px** badges, **8px** cards, **10px** dialogs. No pills except the segmented-control thumb.
- Borders: 1px `--line`.
- Elevation: cards `0 1px 2px rgb(11 27 63 / 0.04)`; popovers and dialogs `0 12px 32px rgb(11 27 63 / 0.12)`. In dark mode, cards have no shadow and popovers use `0 12px 32px rgb(0 0 0 / 0.5)`.
- Icons: Lucide, 16px, stroke 1.5, `--ink-3` unless active.

---

## 3. Information architecture — the story

The product follows the life of a fund's capital. Navigation reads top to bottom in that order, and each page answers one question:

| Stage | Page | Route | The question it answers |
|---|---|---|---|
| — | **Overview** | `/` | What needs my attention today? |
| 1 · Where to look | **Markets** | `/markets` | Which sub-sectors deserve our time? |
| | Segment | `/markets/[segment]` | Is this segment investable, and who's in it? |
| | **Research** | `/research` | What does the evidence say? (agent runs and cited reports) |
| 2 · What to buy | **Pipeline** | `/deals` | Which deals should advance? |
| | **Screen a teaser** | `/deals/new` | Does this new opportunity fit the mandate? |
| | Deal → Overview | `/deals/[id]` | Is this a good business at this price? |
| 3 · What to pay | Deal → Model | `/deals/[id]/model` | What can we pay and still hit the hurdle? |
| | Deal → IC memo | `/deals/[id]/memo` | What do we recommend to the committee? |
| 4 · How it's going | **Portfolio** | `/portfolio` | Which platforms are on or off plan? |
| | Platform | `/portfolio/[id]` | What is happening at this company, and what should we do? |
| | **Covenants** | `/portfolio/covenants` | Where is lender risk building? |
| 5 · When to sell | **Exits** | `/exits` | What should we sell, when, and to whom? |
| | **Fund performance** | `/fund` | How is the fund doing for LPs? |

Cross-links carry the story forward. A segment's white space links to matching pipeline deals. A deal's "Build model" button opens its Model tab, and the Model's "Draft IC memo" button opens the Memo tab. A portfolio alert links to that platform, and a platform's exit plan links to Exits.

---

## 4. Layout system

### 4.1 App shell

```
┌────────────┬─────────────────────────────────────────────────────────────┐
│ ▣ Harrowgate│  Breadcrumb · Deals / Northvale Compliance           ⟳ 1 job │  header 56px
│   Fund VII  ├─────────────────────────────────────────────────────────────┤
│             │  Page title (serif)                        [secondary][primary]
│ Overview    │  One-line description (muted)                                │
│             │  Overview · Model · IC memo    ← tabs (entity pages only)    │
│ ORIGINATION │─────────────────────────────────────────────────────────────│
│ Markets     │  Section 1 ─ summary (stat strip)                            │
│ Research    │                                                              │
│ DEALS       │  Section 2 ─ the main object (table / chart / model)         │
│ Pipeline  ● │                                                              │
│ Screen      │  Section 3 ─ supporting detail                               │
│ PORTFOLIO   │                                     ┌ On this page ┐        │
│ Platforms   │                                     │ sticky anchors│ (≥1280, long pages)
│ Covenants   │                                     └───────────────┘        │
│ Exits       │                                                              │
│ FUND        │                                                              │
│ Performance │                                                              │
│ ─────────── │                                                              │
│ ◐ ✎ user    │                                                              │
└────────────┴─────────────────────────────────────────────────────────────┘
```

- **Sidebar**: 232px wide, `--surface-sunk`, with a hairline right border. Group labels use the eyebrow style. Items are 32px tall with a 16px icon and a label. The active item gets `--accent-soft` background and `--accent` text and icon, with no side marker (removed 26 Oct at the user's request). Only the most specific matching link is active, so a child page such as Screen a teaser or Covenants never lights up its section's link too. Below 1024px it collapses to a 56px icon rail, and below 768px it becomes a drawer behind a menu button.
- **Header**: breadcrumb on the left; the labelled light/dark theme switch on the right.
- **Page header**: title, description, page actions (at most one primary), and tabs for entity pages.
- Content max-width **1280px** inside the main column; side padding 32 / 24 / 16px.
- 12-column grid, 24px gutter.

### 4.2 Sections

Every page is a vertical sequence of `PageSection`s, ordered from summary to detail:

- `PageSection` has a title (16/600), an optional description (`--ink-3`), optional actions on the right, then its content.
- Sections are separated by 48px and a hairline. Content inside a section uses cards on the grid.
- Long pages (deal overview, model, platform) show a sticky **On this page** anchor list on the right at ≥1280px.
- The first section of every list or overview page is a **stat strip**.

### 4.3 Breakpoints

| Name | Width | Behaviour |
|---|---|---|
| `xl` | ≥ 1280 | Full layouts; On-this-page rail visible |
| `lg` | 1024–1279 | Rail hidden; 2-up charts stay 2-up |
| `md` | 768–1023 | Sidebar becomes an icon rail; 2-up charts stack |
| `sm` | < 768 | Sidebar becomes a drawer; single column; tables scroll inside their card |

No horizontal page scroll at any width.

---

## 5. Pages

Each page lists its sections in order. Card widths are 12-column spans.

**Overview `/`** — *What needs my attention today?*
1. Fund at a glance — stat strip: NAV, net IRR, TVPI, DPI, dry powder, deals in diligence.
2. Needs attention — portfolio alerts (Action/Watch) (7) · deals awaiting a decision (5).
3. Activity — running and recent Copilot jobs; newly added deals and reports (live).

**Markets `/markets`** — *Which sub-sectors deserve our time?*
1. Summary — stat strip: segments, total profit pool, median EV/EBITDA, deals in 24m.
2. Growth vs margin — bubble chart (8) · segment shortlist ranked by attractiveness (4).
3. Sponsor attractiveness — table of segments × attributes (DotRating) with a total.
4. Valuation — roll-up multiple arbitrage (6) · exit routes, 24m (6).

**Segment `/markets/[segment]`**
1. Profile — stats, house view, white space (with a link to matching deals).
2. Competitive landscape — known players, recent transactions table.
3. Evidence — research reports for this segment, plus "Run research".

**Research `/research`** — *What does the evidence say?*
1. New research — question, segment, scope → `ProgressSteps` while the agent runs.
2. Reports — list (newest first). Opening one shows the summary, a findings table, and numbered sources.

**Pipeline `/deals`** — *Which deals should advance?*
1. Summary — stat strip: deals, Advance / Watch / Pass, average score, median ask.
2. Pipeline — `DataTable` with verdict filter and search. Clicking a row opens the deal.
3. Flow — stage funnel (6) · score distribution by segment (6).

**Screen a teaser `/deals/new`**
1. Teaser — paste text or upload, then "Extract and screen".
2. Progress — `ProgressSteps` (extract → score → flags).
3. Result — extracted financials for confirmation, then the scorecard, then "Add to pipeline" (the new deal appears live).

**Deal `/deals/[id]`** — header: name, code, segment, stage, verdict. Tabs: **Overview · Model · IC memo**.
- *Overview*: 1 Snapshot (stat strip + thesis) → 2 Scorecard (criteria bars vs targets) → 3 Risks (checks + company flags with mitigants) → 4 Debt capacity → 5 Diligence questions. Primary action: "Build model".
- *Model*: 1 Returns (stat strip: equity cheque, MOIC, IRR vs hurdle, max bid, FCF yield) → 2 Assumptions (sliders, sticky left 3 cols) and Structure (sources & uses, credit profile) → 3 Projections (cash flow and debt schedule) → 4 Sensitivity (IRR heatmap · valuation range) → 5 Value bridge. Actions: case switch, save scenario, export Excel, "Draft IC memo".
- *IC memo*: section picker (3) · memo document (9), with a status per section, citations, and copy/export.

**Portfolio `/portfolio`** — *Which platforms are on or off plan?*
1. Summary — stat strip: invested, fair value, gross MOIC, platforms on plan / watch / action.
2. Platforms — table (status, LTM EBITDA vs budget, leverage, MOIC).
3. Performance — EBITDA vs budget (6) · value creation by lever (6).

**Platform `/portfolio/[id]`** — 1 Snapshot → 2 Performance (quarterly EBITDA vs budget) → 3 Capital structure (facility, covenant, headroom) → 4 Value creation → 5 Alerts and actions → 6 Exit plan.

**Covenants `/portfolio/covenants`** — 1 Headroom summary → 2 Covenant monitor table with `HeadroomMeter` → 3 Test calendar.

**Exits `/exits`** — 1 Readiness summary → 2 Exit planner table (route, buyers, window, implied MOIC) → 3 Exit routes by segment.

**Fund performance `/fund`** — 1 Returns stat strip → 2 J-curve → 3 Distribution waterfall → 4 Cash flows table.

---

## 6. Components — slick specification

| Component | Specification |
|---|---|
| `Button` | 32px, radius 6, 13px/500. **Primary**: `--accent` fill, `--accent-ink` text, 1px border at accent-hover, inset `0 1px 0 rgb(255 255 255 / 0.12)`. **Secondary**: `--surface`, 1px `--line-strong`, card shadow. **Ghost**: no border, `--ink-2`, hover `--surface-sunk`. Optional 16px leading icon. Loading swaps the icon for a spinner and keeps the width. |
| `SegmentedControl` | Track `--surface-sunk` with a hairline, radius 6, 2px inset. The thumb is a `--surface` pill with card shadow that **slides** 150ms between options; labels are 12px/500. |
| `Tabs` | Text tabs 14px/500 `--ink-3` with a hairline under the row. The active tab is `--ink` with a 2px `--accent` underline that slides between tabs. |
| `Badge` | 20px tall, radius 4, 11px/600 sentence case, `--{tone}-soft` background, `--{tone}` text. **No dot, no border.** |
| `Stat` / `StatStrip` | One card divided by vertical hairlines into cells — **not** separate boxes. Each cell: eyebrow label → value → delta/comment in caption style. |
| `Card` | `--surface`, hairline, radius 8, card shadow. Header: title 14/600 on the left, muted description beneath, actions on the right; 16px gap to the body. **No uppercase card titles and no header fill.** |
| `DataTable` | Flush to the card edges (no inner border). Header in the eyebrow style, `--ink-3`, no fill, hairline beneath, sticky. Rows 44px with hairline separators; hover `--surface-sunk`. Selected rows get `--accent-soft` with a 2px inset accent bar. Numbers are right-aligned and tabular. The first column shows the name (500) with a muted sub-line. Keyboard ↑/↓ moves the selection. Built-in states: empty, 5 skeleton rows, error. |
| `ScoreBar` | Figure (tabular) followed by a 48 × 4px bar, radius 2, track `--line`. Fill tone comes from thresholds passed in as props. |
| `Slider` | Label on the left; the value on the right in `--input`, 13px/600, and clickable to type a number. Track 2px `--line` with an `--accent` fill. Thumb 14px `--surface` with a 2px `--accent` ring and card shadow, growing to 16px on drag. |
| `TextField` / `Textarea` / `Select` | 32px (textarea auto-grows), `--surface`, 1px `--line-strong`, radius 6. Focus: `--accent` border plus focus ring. Label 12px/500 `--ink-2` above; help text 12px `--ink-3` below. |
| `HeadroomMeter` | 4px bar with a threshold tick and a percent label on the right. |
| `Callout` / `AlertItem` | **No box.** A row inside a list card: 2px severity stripe on the left, badge + entity on the first line, body in `--ink-2`, "Suggested:" line in `--ink-3`. Rows are separated by hairlines. |
| `ProgressSteps` | Inline steps: 8px dot plus label, joined by hairlines. Done = `--good` dot; current = accent dot with a soft pulse; failed = `--bad` with a Retry link. |
| `PageSection` | See §4.2. |
| `Sidebar`, `Breadcrumb`, `OnThisPage` | See §4.1. |
| `Tooltip` | `--surface-raised`, radius 6, popover shadow, 12px, max 280px, 300ms delay. |
| `Dialog` / `Drawer` | Radius 10, focus trapped, Esc closes, scrim `rgb(7 14 38 / 0.5)`. |
| `EmptyState` / `ErrorState` / `Skeleton` | Muted icon, one sentence, one action. Skeletons match the final layout. |

Every component exposes `data-testid` and appears in `/dev/components` with all variants and states (default, hover, focus, disabled, loading, empty, error) in both themes.

---

## 7. Charts

- Library: **Apache ECharts**, wrapped once in `charts/Chart`. All text uses IBM Plex Sans.
- Plot area 280px tall in cards (200px compact; 32px sparkline).
- Bars 12–16px thick, with 3px rounded data ends and a 2px gap between adjacent bars. Lines 2px, points 8px with a 2px surface ring.
- **One y-axis only.** Horizontal gridlines only, in `--line`; no axis lines except the baseline.
- Legend at top-left for ≥ 2 series, using small square swatches. Direct labels are for highlighted marks only.
- Targets and benchmarks: 2px `--ink-3` tick or a dashed line with a label.
- Waterfall: start/end bars `--series-1`, gains `--good`, losses `--bad`, no connectors.
- Heatmap: diverging scale around the hurdle; cell text switches between `--ink` and white for contrast; 2px surface gaps between cells.
- Hover: per-mark tooltip; crosshair plus shared tooltip on line charts. Clicking a mark that represents an entity selects that entity.
- Every chart has a "View as table" toggle.

---

## 8. Motion

| What | Duration | Easing |
|---|---|---|
| Hover / focus | 120ms | ease-out |
| Segmented thumb, tab underline | 150ms slide | cubic-bezier(0.2, 0, 0, 1) |
| Popover, tooltip, menu | 150ms fade + 4px rise | ease-out |
| Drawer / dialog | 200ms | cubic-bezier(0.2, 0, 0, 1) |
| Page/tab change | 120ms content fade | ease-out |
| Chart first render | 400ms grow; updates 250ms morph | cubic-out |
| Stat value change | 300ms count-up | ease-out |
| Live row (new/updated via SSE) | `--accent-soft` fading over 1.6s | linear |
| Skeleton shimmer | 1.4s loop | linear |

`prefers-reduced-motion: reduce` sets every duration to 0, and the live row becomes a static 1.6s tint.

## 9. States and feedback

- **Loading**: skeletons in the shape of the final content, never a page spinner.
- **Empty**: one sentence and the action that fills it.
- **Error**: inside the affected card only, with Retry; the rest of the page keeps working.
- **Agent output**: a "Copilot" badge plus the model name and timestamp; every figure links to its source.
- **Toasts**: for command completion only, bottom-right, 4s, at most 3.

## 10. Feedback annotation overlay

> **Removed on 26 Oct 2026 (plan step 8.8), at the user's request.** Kept as history.

- A 36px round toggle in the bottom-right corner (`--accent`) and the `Shift+F` shortcut.
- Annotation mode shows a crosshair cursor and a 2px dashed `--accent` outline on the hovered element.
- Pins are 20px numbered circles: `--accent` for open, `--ink-3` for resolved.
- A 360px drawer on the right lists notes with route, element and status.
- Hidden in visual-test screenshots.

## 11. Accessibility

WCAG 2.2 AA: text ≥ 4.5:1 (3:1 for large figures and non-text marks). Every control is keyboard reachable with a visible focus ring. Colour never carries meaning alone. Every page starts with a "Skip to main content" link (first tab stop, visible on focus) that moves focus to the single `main` landmark, and has exactly one `h1`. Charts ship a table view. `aria-live="polite"` announces job completion and new rows.
