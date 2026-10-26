/** Plan steps 6.4 Portfolio, 6.5 Platform, 6.6 Covenants — design §5. */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API, server } from "../setup/server";
import { renderWithApi } from "../setup/render";

const nav = { push: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/portfolio",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: nav.push, replace: vi.fn(), prefetch: vi.fn() }),
}));
const inst = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock("@/components/charts/loadEcharts", () => ({ loadEcharts: async () => ({ init: vi.fn(() => inst) }) }));
const { PortfolioView } = await import("@/features/portfolio/PortfolioView");
const { PlatformView } = await import("@/features/portfolio/PlatformView");
const { CovenantsView } = await import("@/features/portfolio/CovenantsView");

const company = (name: string) => ({ name, hq: "London", description: "", segment_id: "s1" });
const segment = { id: "s1", name: "Legal & professional outsourcing", short: "Legal ops", median_multiple: 9.5 };
const facility = (actual: number, test: number, extra = {}) => ({
  id: `f-${actual}`, company_id: "c", type: "Unitranche", pricing: "SONIA + 5.25%", covenant: `Net leverage below ${test}x`,
  test_level: test, actual, interest_cover: 1.6, cov_lite: false, headroom: 1 - actual / test,
  band: 1 - actual / test < 0 ? "breach" : 1 - actual / test < 0.15 ? "tight" : "comfortable", next_test_date: "2026-12-31", ...extra,
});
const platform = (id: string, name: string, status: string, status_label: string, fv: number, inv: number, ltm: number, bud: number, lev: number, f = facility(lev, 6)) => ({
  id, company_id: `c-${id}`, created_at: "", invest_year: 2021, invested: inv, fair_value: fv, revenue: 100, ebitda_ltm: ltm,
  ebitda_budget: bud, net_leverage: lev, status, status_label, company: company(name), segment, moic: fv / inv,
  budget_variance: ltm / bud - 1, facility: f,
});
const PLATFORMS = [
  platform("p1", "Halden Group", "good", "On plan", 178, 96, 39.5, 37, 3.6, facility(3.6, 5)),
  platform("p2", "Lumen Risk", "acc", "Exit prep", 203, 64, 26, 25.1, 2.1, facility(2.1, 4.5, { cov_lite: true })),
  platform("p3", "Orbis Language Tech", "bad", "Action", 58, 71, 9.2, 12.6, 5.6),
];
const SUMMARY = {
  platforms: 3, invested: 231, fair_value: 439, moic: 439 / 231,
  status_counts: { good: 1, warn: 0, bad: 1, acc: 1 },
  value_bridge: [{ label: "Invested", value: 231 }, { label: "Revenue growth", value: 150 }, { label: "Multiple", value: 58 }, { label: "Fair value", value: 439 }],
};
const DETAIL = {
  ...PLATFORMS[2],
  quarters: Array.from({ length: 8 }, (_, i) => ({ period: `202${i < 1 ? 4 : i < 5 ? 5 : 6}Q${((i + 3) % 4) + 1}`, ebitda: 11.8 - i * 0.37, ebitda_budget: 12.6 })),
  value_creation: [{ lever: "Revenue growth", amount: -8 }, { lever: "Margin", amount: -5 }],
  alerts: [{ id: "a1", company_id: "c-p3", severity: "bad", label: "Action", text: "Net leverage of 5.6x leaves 7% headroom.", action: "Open lender dialogue.", company: company("Orbis Language Tech") }],
  exit_plan: { route: "Recapitalise, then secondary", buyers: "Special situations funds", window: "2028" },
};
const FACILITIES = PLATFORMS.map((p) => ({ ...p.facility, company_id: p.company_id, company: p.company }));

beforeEach(() => {
  nav.push.mockClear();
  server.use(
    http.get(`${API}/api/portfolio-companies`, () => HttpResponse.json({ items: PLATFORMS, total: 3 })),
    http.get(`${API}/api/portfolio-summary`, () => HttpResponse.json(SUMMARY)),
    http.get(`${API}/api/portfolio-companies/p3`, () => HttpResponse.json(DETAIL)),
    http.get(`${API}/api/portfolio-companies/nope`, () => HttpResponse.json({ error: { code: "not_found", message: "x" } }, { status: 404 })),
    http.get(`${API}/api/debt-facilities`, () => HttpResponse.json({ items: FACILITIES, total: 3 })),
    http.get(`${API}/api/covenant-summary`, () =>
      HttpResponse.json({ facilities: 3, below_comfort: 1, comfort_threshold: 0.15, next_test_date: "2026-12-31", tightest: { company: "Orbis Language Tech", headroom: 1 - 5.6 / 6 } }),
    ),
  );
});

describe("PortfolioView (6.4)", () => {
  it("summarises the portfolio from the backend", async () => {
    renderWithApi(<PortfolioView />);
    const s = await screen.findByRole("region", { name: "Summary" });
    await waitFor(() => expect(s).toHaveTextContent("£439.0m"));
    expect(s).toHaveTextContent("£231.0m");
    expect(s).toHaveTextContent("1.90x");
    expect(within(s).getByText("On plan").closest("li")).toHaveTextContent("1");
    expect(within(s).getByText("Need action").closest("li")).toHaveTextContent("1");
  });

  it("lists platforms with performance against budget and a status", async () => {
    renderWithApi(<PortfolioView />);
    const row = await screen.findByRole("row", { name: /Orbis Language Tech/ });
    expect(row).toHaveTextContent("Legal ops");
    expect(row).toHaveTextContent("0.82x");
    expect(row).toHaveTextContent("−27.0%");
    expect(within(row).getByText("−27.0%")).toHaveAttribute("data-tone", "bad");
    expect(within(row).getByText("Action")).toHaveAttribute("data-tone", "bad");
    const halden = screen.getByRole("row", { name: /Halden/ });
    expect(within(halden).getByText("+6.8%")).toHaveAttribute("data-tone", "good");
    expect(within(halden).getByText("On plan")).toHaveAttribute("data-tone", "good");
    expect(within(screen.getByRole("row", { name: /Lumen/ })).getByText("Exit prep")).toHaveAttribute("data-tone", "accent");
  });

  it("opens a platform from its row", async () => {
    const user = userEvent.setup();
    renderWithApi(<PortfolioView />);
    await user.click(await screen.findByRole("row", { name: /Orbis/ }));
    expect(nav.push).toHaveBeenCalledWith("/portfolio/p3");
  });

  it("charts earnings against plan and where value came from", async () => {
    renderWithApi(<PortfolioView />);
    const perf = await screen.findByRole("region", { name: "Performance" });
    expect(within(perf).getByRole("img", { name: "LTM EBITDA vs budget" })).toBeInTheDocument();
    expect(within(perf).getByRole("img", { name: "Value creation" })).toBeInTheDocument();
  });
});

describe("PlatformView (6.5)", () => {
  it("has six sections in summary-to-detail order", async () => {
    renderWithApi(<PlatformView platformId="p3" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Orbis Language Tech" })).toBeInTheDocument();
    for (const n of ["Snapshot", "Performance", "Capital structure", "Value creation", "Alerts and actions", "Exit plan"]) {
      expect(screen.getByRole("region", { name: n })).toBeInTheDocument();
    }
    expect(within(screen.getByTestId("page-header")).getByText("Action")).toHaveAttribute("data-tone", "bad");
  });

  it("shows the snapshot, quarterly performance and covenant headroom", async () => {
    renderWithApi(<PlatformView platformId="p3" />);
    const snap = await screen.findByRole("region", { name: "Snapshot" });
    await waitFor(() => expect(snap).toHaveTextContent("£58.0m"));
    expect(snap).toHaveTextContent("0.82x");
    expect(snap).toHaveTextContent("£9.2m");
    expect(snap).toHaveTextContent("−27.0% vs budget");
    expect(snap).toHaveTextContent("5.6x");
    expect(screen.getByRole("img", { name: "Quarterly EBITDA vs budget" })).toBeInTheDocument();
    const cap = screen.getByRole("region", { name: "Capital structure" });
    expect(within(cap).getByRole("meter", { name: "Covenant headroom" })).toHaveAttribute("data-tone", "warn");
    expect(cap).toHaveTextContent("SONIA + 5.25%");
  });

  it("shows alerts with suggested actions and the exit plan", async () => {
    renderWithApi(<PlatformView platformId="p3" />);
    const alerts = await screen.findByRole("region", { name: "Alerts and actions" });
    await waitFor(() => expect(alerts).toHaveTextContent("Net leverage of 5.6x leaves 7% headroom."));
    expect(alerts).toHaveTextContent("Suggested: Open lender dialogue.");
    expect(screen.getByRole("region", { name: "Exit plan" })).toHaveTextContent("Recapitalise, then secondary");
    const vc = screen.getByRole("region", { name: "Value creation" });
    expect(within(vc).getAllByRole("heading", { name: "Value creation" })).toHaveLength(1);
  });

  it("handles an unknown platform", async () => {
    renderWithApi(<PlatformView platformId="nope" />);
    expect(await screen.findByText(/couldn.t find that platform/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to platforms/i })).toHaveAttribute("href", "/portfolio");
  });
});

describe("CovenantsView (6.6)", () => {
  it("summarises headroom", async () => {
    renderWithApi(<CovenantsView />);
    const s = await screen.findByRole("region", { name: "Headroom summary" });
    await waitFor(() => expect(s).toHaveTextContent("Orbis Language Tech"));
    expect(s).toHaveTextContent("6.7%");
    expect(within(s).getByText("Below comfort").closest("li")).toHaveTextContent("1");
    expect(s).toHaveTextContent("31 Dec 2026");
  });

  it("monitors every facility, tightest first, with a headroom meter", async () => {
    renderWithApi(<CovenantsView />);
    const table = await screen.findByRole("table", { name: "Covenant monitor" });
    const rows = within(table).getAllByRole("row").slice(1);
    await waitFor(() => expect(rows[0]).toHaveTextContent("Orbis Language Tech"));
    expect(within(rows[0]!).getByRole("meter")).toHaveAttribute("data-tone", "warn");
    expect(within(screen.getByRole("row", { name: /Lumen/ })).getByText("Cov-lite")).toBeInTheDocument();
  });

  it("lists upcoming tests by date", async () => {
    renderWithApi(<CovenantsView />);
    const cal = await screen.findByRole("region", { name: "Test calendar" });
    await waitFor(() => expect(cal).toHaveTextContent("31 Dec 2026"));
    expect(within(cal).getAllByRole("listitem").length).toBeGreaterThanOrEqual(3);
  });
});
