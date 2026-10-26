/** Plan steps 6.9 Markets, 6.10 Segment, 6.11 Overview — design §5. */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API, server } from "../setup/server";
import { FakeEventSource, renderWithApi } from "../setup/render";

const nav = { push: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/markets",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: nav.push, replace: vi.fn(), prefetch: vi.fn() }),
}));
const inst = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock("@/components/charts/loadEcharts", () => ({ loadEcharts: async () => ({ init: vi.fn(() => inst) }) }));
const { MarketsView } = await import("@/features/markets/MarketsView");
const { SegmentView } = await import("@/features/markets/SegmentView");
const { OverviewView } = await import("@/features/overview/OverviewView");

const ATTRS = ["Non-cyclical", "Contracted / recurring", "Technical moat", "Synergy potential", "Industry tailwinds", "Fragmented / local"];
const seg = (id: string, name: string, short: string, scores: number[], extra = {}) => ({
  id, name, short, created_at: "", market_size: 9, cagr: 0.11, avg_margin: 0.24, fragmentation: "High", ai_exposure: "Medium",
  median_multiple: 16, addon_multiple: 8, typical_leverage: 5, deal_count_24m: 23,
  view: "Regulatory load keeps rising.", white_space: "Financial crime outsourcing for payments firms.",
  attributes: ATTRS.map((attribute, i) => ({ attribute, score: scores[i] })), attractiveness: scores.reduce((a, b) => a + b, 0), attractiveness_max: 18,
  ...extra,
});
const SEGMENTS = [seg("s1", "Compliance & regulatory services", "Compliance", [3, 2, 2, 2, 3, 3]), seg("s2", "Legal & professional outsourcing", "Legal ops", [2, 1, 0, 1, 0, 2], { cagr: 0.08 })];
const deal = (id: string, name: string, verdict: string, score: number) => ({
  id, code_name: "P", stage: "CIM", ask_multiple: 15.5, company: { name, hq: "London", description: "", segment_id: "s1" },
  segment: { id: "s1", name: "Compliance", short: "Compliance", median_multiple: 16 }, financials: { ebitda: 14.6 },
  screening: { score, verdict, gate_reason: null }, watchlisted: false,
});
const DETAIL = {
  ...SEGMENTS[0],
  exit_route_mix: { strategic_pct: 40, sponsor_pct: 55, ipo_pct: 5 },
  transactions: [
    { id: "t1", date: "2026-08-01", target: "Clearmark", acquirer: "Big Four arm", segment_id: "s1", ev: 180, ev_ebitda: 15.2, route: "strategic" },
    { id: "t2", date: "2026-03-10", target: "Regula", acquirer: "Sponsor X", segment_id: "s1", ev: 120, ev_ebitda: 14.1, route: "sponsor" },
  ],
  players: [{ name: "Lumen Risk", kind: "portfolio", id: "p2" }, { name: "Northvale Compliance", kind: "pipeline", id: "d1" }],
  matching_deals: [deal("d1", "Northvale Compliance", "Advance", 81)],
  reports: [],
};

let researchCalls: unknown[];
beforeEach(() => {
  nav.push.mockClear();
  researchCalls = [];
  server.use(
    http.get(`${API}/api/segments`, () => HttpResponse.json({ items: SEGMENTS, total: 2 })),
    http.get(`${API}/api/segments/s1`, () => HttpResponse.json(DETAIL)),
    http.get(`${API}/api/market-summary`, () => HttpResponse.json({ segments: 7, profit_pool: 132, median_multiple: 13, deals_24m: 193, reports: 0 })),
    http.get(`${API}/api/exit-route-mixes`, () => HttpResponse.json({ items: [], total: 0 })),
    http.post(`${API}/api/commands/start-market-research`, async ({ request }) => {
      researchCalls.push(await request.json());
      return HttpResponse.json({ id: "j1", kind: "market_research", status: "queued", progress: [], input: {}, result_ref: null, error: null, created_at: "", updated_at: "", source: "user" }, { status: 202 });
    }),
    http.get(`${API}/api/jobs/j1`, () => HttpResponse.json({ id: "j1", kind: "market_research", status: "queued", progress: [], input: {}, result_ref: null, error: null, created_at: "", updated_at: "", source: "user" })),
    http.get(`${API}/api/overview-summary`, () =>
      HttpResponse.json({
        nav: 1182, net_irr: 0.126, tvpi: 1.46, dpi: 0.38, dry_powder: 412, aum: 1594, in_diligence: 3, pipeline_total: 8, alerts: { bad: 1, warn: 2, acc: 2 },
        lifecycle: { vintage: 2019, year: 8, term_years: 10, phase: "Harvesting" },
      }),
    ),
    http.get(`${API}/api/alerts`, () =>
      HttpResponse.json({ items: [{ id: "a1", company_id: "c", severity: "bad", label: "Action", text: "Covenant headroom is 7%.", action: "Open lender dialogue.", company: { name: "Orbis Language Tech" } }], total: 1 }),
    ),
    http.get(`${API}/api/deals`, () => HttpResponse.json({ items: [deal("d1", "Northvale Compliance", "Advance", 81)], total: 1 })),
    http.get(`${API}/api/jobs`, () => HttpResponse.json({ items: [{ id: "j9", kind: "market_research", status: "running", progress: [{ step: "search", message: "Running 6 queries" }], input: {}, result_ref: null, error: null, created_at: "", updated_at: "", source: "user" }], total: 1 })),
    http.get(`${API}/api/funds`, () => HttpResponse.json({ items: [{ id: "f", name: "Harrowgate Fund VII", committed: 1400, verdict_advance: 68, verdict_watch: 55 }], total: 1 })),
  );
});

describe("MarketsView (6.9)", () => {
  it("summarises the market map", async () => {
    renderWithApi(<MarketsView />);
    const s = await screen.findByRole("region", { name: "Summary" });
    await waitFor(() => expect(s).toHaveTextContent("£132bn"));
    expect(s).toHaveTextContent("13.0x");
    expect(s).toHaveTextContent("193");
  });

  it("plots growth against margin and ranks a shortlist", async () => {
    renderWithApi(<MarketsView />);
    const g = await screen.findByRole("region", { name: "Growth vs margin" });
    expect(within(g).getByRole("img", { name: "Growth vs margin" })).toBeInTheDocument();
    const items = await within(g).findAllByRole("link");
    expect(items[0]).toHaveTextContent("Compliance");
    expect(items[0]).toHaveTextContent("15 / 18");
    expect(items[0]).toHaveAttribute("href", "/markets/s1");
  });

  it("scores sponsor attractiveness with dot ratings", async () => {
    renderWithApi(<MarketsView />);
    const a = await screen.findByRole("region", { name: "Sponsor attractiveness" });
    const row = await within(a).findByRole("row", { name: /Legal ops/ });
    expect(within(row).getByRole("img", { name: "Technical moat: 0 of 3" })).toBeInTheDocument();
    expect(row).toHaveTextContent("6 / 18");
  });

  it("charts valuation: multiple arbitrage and exit routes", async () => {
    renderWithApi(<MarketsView />);
    const v = await screen.findByRole("region", { name: "Valuation" });
    expect(within(v).getByRole("img", { name: "Roll-up multiple arbitrage" })).toBeInTheDocument();
    expect(within(v).getByRole("img", { name: "Exit routes, last 24 months" })).toBeInTheDocument();
  });
});

describe("SegmentView (6.10)", () => {
  it("profiles the segment with the house view and white space", async () => {
    renderWithApi(<SegmentView segmentId="s1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Compliance & regulatory services" })).toBeInTheDocument();
    const p = screen.getByRole("region", { name: "Profile" });
    expect(p).toHaveTextContent("Regulatory load keeps rising.");
    expect(p).toHaveTextContent("Financial crime outsourcing for payments firms.");
    expect(p).toHaveTextContent("11.0%");
    expect(within(p).getByRole("link", { name: /Northvale Compliance/ })).toHaveAttribute("href", "/deals/d1");
  });

  it("lists recent transactions and known players", async () => {
    renderWithApi(<SegmentView segmentId="s1" />);
    const l = await screen.findByRole("region", { name: "Competitive landscape" });
    const t = await within(l).findByRole("table", { name: "Recent transactions" });
    expect(within(t).getAllByRole("row")[1]).toHaveTextContent("Clearmark");
    expect(within(t).getAllByRole("row")[1]).toHaveTextContent("15.2x");
    expect(within(l).getByRole("link", { name: "Lumen Risk" })).toHaveAttribute("href", "/portfolio/p2");
  });

  it("starts research for this segment from the evidence section", async () => {
    const user = userEvent.setup();
    renderWithApi(<SegmentView segmentId="s1" />);
    const e = await screen.findByRole("region", { name: "Evidence" });
    expect(e).toHaveTextContent(/no research yet/i);
    await user.type(within(e).getByLabelText("Research question"), "How fast is KYC outsourcing growing?");
    await user.click(within(e).getByRole("button", { name: "Run research" }));
    await waitFor(() => expect(researchCalls).toEqual([{ question: "How fast is KYC outsourcing growing?", segment_id: "s1" }]));
    expect(await within(e).findByText(/queued/i)).toBeInTheDocument();
  });
});

describe("OverviewView (6.11)", () => {
  it("leads with the fund at a glance", async () => {
    renderWithApi(<OverviewView />);
    const f = await screen.findByRole("region", { name: "Fund at a glance" });
    await waitFor(() => expect(f).toHaveTextContent("£1.2bn"));
    expect(f).toHaveTextContent("12.6%");
    expect(f).toHaveTextContent("1.46x");
    expect(f).toHaveTextContent("£412.0m");
    expect(f).toHaveTextContent("3");
  });

  it("puts alerts and deals awaiting a decision side by side", async () => {
    renderWithApi(<OverviewView />);
    const n = await screen.findByRole("region", { name: "Needs attention" });
    await waitFor(() => expect(n).toHaveTextContent("Orbis Language Tech"));
    expect(n).toHaveTextContent("Suggested: Open lender dialogue.");
    expect(within(n).getByRole("link", { name: /Northvale Compliance/ })).toHaveAttribute("href", "/deals/d1");
  });

  // Feedback round 8.4 (user notes on /): no Copilot activity section; the subtitle is "Fund at a glance".
  it("has no Copilot activity section", async () => {
    renderWithApi(<OverviewView />);
    await screen.findByRole("region", { name: "Needs attention" });
    expect(screen.queryByRole("region", { name: "Copilot activity" })).not.toBeInTheDocument();
    expect(screen.queryByText(/copilot activity/i)).not.toBeInTheDocument();
  });

  it("uses 'Fund at a glance' as the page subtitle instead of a question or a second heading", async () => {
    renderWithApi(<OverviewView />);
    const header = await screen.findByTestId("page-header");
    expect(header).toHaveTextContent("Fund at a glance");
    expect(screen.queryByText(/what needs your attention today/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Fund at a glance" })).not.toBeInTheDocument();
  });

  it("adds AUM and the fund's lifecycle to the fund at a glance", async () => {
    renderWithApi(<OverviewView />);
    const f = await screen.findByRole("region", { name: "Fund at a glance" });
    await waitFor(() => expect(f).toHaveTextContent("£1.6bn"));
    expect(f).toHaveTextContent(/AUM/i);
    expect(f).toHaveTextContent("Year 8 of 10");
    expect(f).toHaveTextContent("Harvesting");
    expect(f).toHaveTextContent("2019");
  });
});
