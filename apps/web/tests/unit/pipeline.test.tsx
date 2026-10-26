import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API, server } from "../setup/server";
import { FakeEventSource, Providers, renderWithApi } from "../setup/render";

// ---- next/navigation stand-in with a controllable URL ----
const nav = { pathname: "/deals", search: "", push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: nav.replace, prefetch: vi.fn() }),
}));
const echartsInstance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock("@/components/charts/loadEcharts", () => ({ loadEcharts: async () => ({ init: vi.fn(() => echartsInstance) }) }));

const { useUrlState } = await import("@/hooks/useUrlState");
const { PipelineView } = await import("@/features/pipeline/PipelineView");

// ---- fixtures shaped like the generated contract ----
const deal = (id: string, name: string, verdict: "Advance" | "Watch" | "Pass", score: number, extra = {}) => ({
  id,
  code_name: `Project ${name.split(" ")[0]}`,
  stage: "CIM",
  ask_multiple: 15.5,
  process: "Targeted auction",
  origin: "seed",
  source: "seed",
  company: { id: `c-${id}`, name, hq: "London, UK", description: "", segment_id: "s1" },
  segment: { id: "s1", name: "Compliance & regulatory services", short: "Compliance", median_multiple: 16 },
  financials: { revenue: 61, ebitda: 14.6, growth: 0.22, recurring_pct: 0.71, capex_pct: 0.03 },
  screening: { score, verdict },
  ...extra,
});
const DEALS = [
  deal("d1", "Northvale Compliance", "Advance", 81),
  deal("d2", "Veritest Group", "Watch", 60, { stage: "NDA", ask_multiple: 13.5, financials: { revenue: 142, ebitda: 31, growth: 0.11, recurring_pct: 0.64, capex_pct: 0.065 } }),
  deal("d3", "Meridian Legal Ops", "Pass", 47, { stage: "Teaser", ask_multiple: 11 }),
];
const SUMMARY = {
  total: 3,
  counts: { Advance: 1, Watch: 1, Pass: 1 },
  average_score: 62.67,
  median_ask: 13.5,
  by_stage: ["Teaser", "NDA", "CIM", "IOI", "LOI", "Exclusivity", "SPA"].map((stage) => ({
    stage,
    count: { Teaser: 1, NDA: 1, CIM: 1 }[stage] ?? 0,
  })),
  by_segment: [{ segment_id: "s1", short: "Compliance", count: 3, average_score: 62.67, best_score: 81 }],
};
const FUND = { id: "f1", name: "Harrowgate Fund VII", committed: 1400, verdict_advance: 68, verdict_watch: 55 };

let dealRequests: URL[] = [];
let summaryCalls = 0;
let failDeals = false;

beforeEach(() => {
  nav.pathname = "/deals";
  nav.search = "";
  nav.push.mockClear();
  nav.replace.mockClear();
  dealRequests = [];
  summaryCalls = 0;
  failDeals = false;
  server.use(
    http.get(`${API}/api/deals`, ({ request }) => {
      const url = new URL(request.url);
      dealRequests.push(url);
      if (failDeals) return HttpResponse.json({ error: { code: "boom", message: "Server error" } }, { status: 500 });
      const v = url.searchParams.get("verdict");
      const items = v ? DEALS.filter((d) => d.screening.verdict === v) : DEALS;
      return HttpResponse.json({ items, total: items.length });
    }),
    http.get(`${API}/api/pipeline-summary`, () => {
      summaryCalls += 1;
      return HttpResponse.json(SUMMARY);
    }),
    http.get(`${API}/api/funds`, () => HttpResponse.json({ items: [FUND], total: 1 })),
  );
});

describe("useUrlState", () => {
  it("reads the current value or falls back to the default", () => {
    nav.search = "verdict=Advance";
    const { result } = renderHook(() => useUrlState("verdict", "All"), { wrapper: Providers });
    expect(result.current[0]).toBe("Advance");
    nav.search = "";
    const { result: r2 } = renderHook(() => useUrlState("verdict", "All"), { wrapper: Providers });
    expect(r2.current[0]).toBe("All");
  });

  it("writes to the URL without adding history, and drops the default", () => {
    nav.search = "sort=-score";
    const { result } = renderHook(() => useUrlState("verdict", "All"), { wrapper: Providers });
    act(() => result.current[1]("Watch"));
    expect(nav.replace).toHaveBeenLastCalledWith("/deals?sort=-score&verdict=Watch", { scroll: false });
    act(() => result.current[1]("All"));
    expect(nav.replace).toHaveBeenLastCalledWith("/deals?sort=-score", { scroll: false });
  });
});

describe("PipelineView", () => {
  it("opens with a summary strip computed by the backend", async () => {
    renderWithApi(<PipelineView />);
    const summary = await screen.findByRole("region", { name: "Summary" });
    await waitFor(() => expect(within(summary).getByText("Deals").closest("li")).toHaveTextContent("3"));
    expect(within(summary).getByText("Advance").closest("li")).toHaveTextContent("1");
    expect(within(summary).getByText("Average score").closest("li")).toHaveTextContent("63");
    expect(within(summary).getByText("Median ask").closest("li")).toHaveTextContent("13.5x");
  });

  it("lists deals with formatted figures and verdicts", async () => {
    renderWithApi(<PipelineView />);
    const table = await screen.findByRole("table", { name: "Deals" });
    const row = await within(table).findByRole("row", { name: /Northvale Compliance/ });
    expect(row).toHaveTextContent("Compliance · London, UK");
    expect(row).toHaveTextContent("14.6");
    expect(row).toHaveTextContent("71%");
    expect(row).toHaveTextContent("15.5x");
    expect(within(row).getByRole("meter", { name: /score/i })).toHaveAttribute("data-tone", "good");
    expect(within(row).getByText("Advance")).toHaveAttribute("data-tone", "good");
    expect(within(table).getByRole("row", { name: /Meridian/ })).toHaveTextContent("Pass");
  });

  it("uses the fund's verdict thresholds for score tones, not hard-coded ones", async () => {
    server.use(http.get(`${API}/api/funds`, () => HttpResponse.json({ items: [{ ...FUND, verdict_advance: 85 }], total: 1 })));
    renderWithApi(<PipelineView />);
    const row = await screen.findByRole("row", { name: /Northvale Compliance/ });
    await waitFor(() => expect(within(row).getByRole("meter", { name: /score/i })).toHaveAttribute("data-tone", "warn"));
  });

  it("filters by verdict through the URL, and the server does the filtering", async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithApi(<PipelineView />);
    await screen.findByRole("row", { name: /Northvale/ });
    await user.click(screen.getByRole("button", { name: "Advance" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/deals?verdict=Advance", { scroll: false });
    unmount();

    nav.search = "verdict=Advance";
    renderWithApi(<PipelineView />);
    await screen.findByRole("row", { name: /Northvale/ });
    expect(screen.getByRole("button", { name: "Advance" })).toHaveAttribute("aria-pressed", "true");
    expect(dealRequests.at(-1)?.searchParams.get("verdict")).toBe("Advance");
    expect(screen.queryByRole("row", { name: /Meridian/ })).not.toBeInTheDocument();
  });

  it("opens a deal from its row", async () => {
    const user = userEvent.setup();
    renderWithApi(<PipelineView />);
    await user.click(await screen.findByRole("row", { name: /Veritest/ }));
    expect(nav.push).toHaveBeenCalledWith("/deals/d2");
  });

  it("offers screening a new teaser as the page's primary action", async () => {
    renderWithApi(<PipelineView />);
    expect(screen.getByRole("link", { name: /screen a teaser/i })).toHaveAttribute("href", "/deals/new");
  });

  it("charts the flow by stage and by segment", async () => {
    renderWithApi(<PipelineView />);
    const flow = await screen.findByRole("region", { name: "Flow" });
    expect(within(flow).getByRole("img", { name: "Deals by stage" })).toBeInTheDocument();
    expect(within(flow).getByRole("img", { name: "Average score by segment" })).toBeInTheDocument();
  });

  it("highlights deals that change live and refreshes the summary", async () => {
    renderWithApi(<PipelineView />);
    await screen.findByRole("row", { name: /Meridian/ });
    const before = summaryCalls;
    act(() => FakeEventSource.last?.emit("changed", { type: "changed", resources: ["deals"], ids: ["d3"] }));
    expect(screen.getByRole("row", { name: /Meridian/ })).toHaveAttribute("data-recent", "true");
    await waitFor(() => expect(summaryCalls).toBeGreaterThan(before));
  });

  it("shows an error with retry when deals fail to load", async () => {
    failDeals = true;
    const user = userEvent.setup();
    renderWithApi(<PipelineView />);
    await screen.findByText(/couldn.t load deals/i);
    failDeals = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("row", { name: /Northvale/ })).toBeInTheDocument();
  });
});
