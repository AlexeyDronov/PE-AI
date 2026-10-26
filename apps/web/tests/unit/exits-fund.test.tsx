/** Plan steps 6.7 Exits and 6.8 Fund performance — design §5. */
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API, server } from "../setup/server";
import { renderWithApi } from "../setup/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/exits",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
const inst = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock("@/components/charts/loadEcharts", () => ({ loadEcharts: async () => ({ init: vi.fn(() => inst) }) }));
const { ExitsView } = await import("@/features/exits/ExitsView");
const { FundView } = await import("@/features/fund/FundView");

const co = (name: string) => ({ name, hq: "London", description: "", segment_id: "s1" });
const plan = (id: string, name: string, route: string, window: string, moic: number, fv: number, status: string, status_label: string) => ({
  id, company_id: `c${id}`, created_at: "", route, buyers: "Strategics", window, company: co(name),
  platform: { id: `p${id}`, moic, fair_value: fv, status, status_label },
});
const PLANS = [
  plan("1", "Lumen Risk", "Strategic", "H1 2027", 3.17, 203, "acc", "Exit prep"),
  plan("2", "Orbis Language Tech", "Recapitalise, then secondary", "2028", 0.82, 58, "bad", "Action"),
];
const MIXES = [{ id: "m1", segment_id: "s1", strategic_pct: 45, sponsor_pct: 50, ipo_pct: 5, segment: { id: "s1", name: "TIC", short: "TIC", median_multiple: 14.5 } }];
const series = [2019, 2020, 2021, 2022].map((y, i) => ({ period: String(y), calls: [200, 300, 0, 0][i], distributions: [0, 0, 100, 150][i], nav: [200, 520, 600, 560][i], cumulative_net: [-200, -500, -400, -250][i] }));
const FUND = {
  id: "f1", name: "Harrowgate Fund VII", vintage: 2019, committed: 1400, irr_hurdle: 0.2, pref_rate: 0.08, carry: 0.2, catch_up: 1,
  metrics: {
    called: 500, distributed: 250, nav: 560, dpi: 0.5, tvpi: 1.62, net_irr: 0.126, series,
    gross_profit: 310, lp_total: 748, gp_carry: 62,
    waterfall: [
      { label: "Return of capital", lp: 500, gp: 0 }, { label: "Preferred return", lp: 180, gp: 0 },
      { label: "GP catch-up", lp: 0, gp: 45 }, { label: "Carried interest split", lp: 68, gp: 17 },
    ],
  },
};

beforeEach(() => {
  server.use(
    http.get(`${API}/api/exit-plans`, () => HttpResponse.json({ items: PLANS, total: 2 })),
    http.get(`${API}/api/exit-summary`, () => HttpResponse.json({ platforms: 6, exit_prep: 1, exit_prep_fair_value: 203, routes: { Strategic: 3, Secondary: 2, Recap: 1 } })),
    http.get(`${API}/api/exit-route-mixes`, () => HttpResponse.json({ items: MIXES, total: 1 })),
    http.get(`${API}/api/funds`, () => HttpResponse.json({ items: [FUND], total: 1 })),
    http.get(`${API}/api/fund-cashflows`, () => HttpResponse.json({ items: series.map((s, i) => ({ id: `cf${i}`, created_at: "", ...s })), total: 4 })),
  );
});

describe("ExitsView (6.7)", () => {
  it("has readiness, planner and routes sections", async () => {
    renderWithApi(<ExitsView />);
    for (const n of ["Readiness", "Exit planner", "Exit routes by segment"]) expect(await screen.findByRole("region", { name: n })).toBeInTheDocument();
    const r = screen.getByRole("region", { name: "Readiness" });
    await waitFor(() => expect(r).toHaveTextContent("£203.0m"));
    expect(within(r).getByText("In exit prep").closest("li")).toHaveTextContent("1");
  });

  it("plans each exit with route, buyers, window and current returns", async () => {
    renderWithApi(<ExitsView />);
    const row = await screen.findByRole("row", { name: /Lumen Risk/ });
    expect(row).toHaveTextContent("Strategic");
    expect(row).toHaveTextContent("H1 2027");
    expect(row).toHaveTextContent("3.17x");
    expect(within(row).getByText("Exit prep")).toHaveAttribute("data-tone", "accent");
    expect(within(row).getByRole("link", { name: "Lumen Risk" })).toHaveAttribute("href", "/portfolio/p1");
  });

  it("lists the soonest exit window first (found in browser review)", async () => {
    server.use(http.get(`${API}/api/exit-plans`, () => HttpResponse.json({ items: [...PLANS].reverse(), total: 2 })));
    renderWithApi(<ExitsView />);
    const table = await screen.findByRole("table");
    const rows = await within(table).findAllByRole("row");
    expect(rows[1]).toHaveTextContent("Lumen Risk");
    expect(rows[2]).toHaveTextContent("Orbis Language Tech");
  });

  it("charts buyer mix by segment", async () => {
    renderWithApi(<ExitsView />);
    expect(await screen.findByRole("img", { name: "Exit routes by segment" })).toBeInTheDocument();
  });
});

describe("FundView (6.8)", () => {
  it("leads with returns", async () => {
    renderWithApi(<FundView />);
    const r = await screen.findByRole("region", { name: "Returns" });
    await waitFor(() => expect(r).toHaveTextContent("12.6%"));
    expect(r).toHaveTextContent("1.62x");
    expect(r).toHaveTextContent("0.50x");
    expect(r).toHaveTextContent("£560.0m");
    expect(r).toHaveTextContent("36% of £1.4bn");
  });

  it("charts the J-curve and the distribution waterfall", async () => {
    renderWithApi(<FundView />);
    expect(await screen.findByRole("img", { name: "Fund J-curve" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Distribution waterfall" })).toBeInTheDocument();
    const w = screen.getByRole("region", { name: "Distribution waterfall" });
    expect(w).toHaveTextContent("8% preferred return");
    expect(w).toHaveTextContent("20% carry");
    expect(w).toHaveTextContent("GP carry £62.0m");
  });

  it("explains why no carry has been earned yet (found in browser review)", async () => {
    server.use(http.get(`${API}/api/funds`, () => HttpResponse.json({ items: [{ ...FUND, metrics: { ...FUND.metrics, gp_carry: 0 } }], total: 1 })));
    renderWithApi(<FundView />);
    const w = await screen.findByRole("region", { name: "Distribution waterfall" });
    await waitFor(() => expect(w).toHaveTextContent("No carry earned yet: the 8% preferred return is not yet covered."));
  });

  it("tabulates cash flows by year with financial formatting", async () => {
    renderWithApi(<FundView />);
    const t = await screen.findByRole("table", { name: "Cash flows" });
    const row2021 = await within(t).findByRole("row", { name: /2021/ });
    expect(row2021).toHaveTextContent("100.0");
    expect(row2021).toHaveTextContent("(400.0)");
  });
});
