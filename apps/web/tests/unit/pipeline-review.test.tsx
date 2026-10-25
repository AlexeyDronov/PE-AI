/** Issues found in browser review of /deals with real data (step 6.1). */
import { screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { barOption } from "@/components/charts/options";
import type { ChartTheme } from "@/components/charts/theme";
import { API, server } from "../setup/server";
import { renderWithApi } from "../setup/render";

const nav = { search: "" };
vi.mock("next/navigation", () => ({
  usePathname: () => "/deals",
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
const inst = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock("echarts", () => ({ init: vi.fn(() => inst), default: { init: vi.fn(() => inst) } }));
const { PipelineView } = await import("@/features/pipeline/PipelineView");

const theme = {
  fontFamily: "x", ink: "#000000", ink2: "#111111", ink3: "#222222", line: "#EEEEEE", lineStrong: "#DDDDDD",
  surface: "#FFFFFF", raised: "#FFFFFF", series: ["#1F45C8", "#E8692E", "#13A06F", "#B98200", "#D9608F"],
  other: "#8A94A6", good: "#11734A", bad: "#B42330", diverging: { lo: "#B42330", mid: "#F1F2F5", hi: "#1F45C8" },
} satisfies ChartTheme;

const row = (id: string, name: string, verdict: string, score: number, gate_reason: string | null = null) => ({
  id, code_name: "P", stage: "Teaser", ask_multiple: 12, process: "", origin: "seed", source: "seed",
  company: { id: `c${id}`, name, hq: "Bristol, UK", description: "", segment_id: "s1" },
  segment: { id: "s1", name: "Compliance", short: "Compliance", median_multiple: 16 },
  financials: { revenue: 39, ebitda: 7.1, growth: 0.31, recurring_pct: 0.58, capex_pct: 0.03 },
  screening: { score, verdict, gate_reason },
});

let dealUrls: URL[] = [];
beforeEach(() => {
  nav.search = "";
  dealUrls = [];
  server.use(
    http.get(`${API}/api/deals`, ({ request }) => {
      dealUrls.push(new URL(request.url));
      const items = [
        row("d1", "Brightwater Assurance", "Pass", 63, "EBITDA £7.1m is below the £10m mandate floor"),
        row("d2", "Northvale Compliance", "Advance", 81),
      ];
      return HttpResponse.json({ items, total: 2 });
    }),
    http.get(`${API}/api/pipeline-summary`, () =>
      HttpResponse.json({ total: 2, counts: { Advance: 1, Watch: 0, Pass: 1 }, average_score: 72, median_ask: 12, by_stage: [], by_segment: [] }),
    ),
    http.get(`${API}/api/funds`, () =>
      HttpResponse.json({ items: [{ id: "f", name: "F", committed: 1400, verdict_advance: 68, verdict_watch: 55, ebitda_min: 10, ebitda_max: 60, irr_hurdle: 0.2, max_leverage: 4.5 }], total: 1 }),
    ),
  );
});

describe("Pipeline review fixes", () => {
  it("asks the server for deals sorted by score, best first, by default", async () => {
    renderWithApi(<PipelineView />);
    await screen.findByRole("row", { name: /Northvale/ });
    expect(dealUrls[0]?.searchParams.get("sort")).toBe("-score");
  });

  it("shows Pass in the bad tone, per the design system", async () => {
    renderWithApi(<PipelineView />);
    const r = await screen.findByRole("row", { name: /Brightwater/ });
    expect(within(r).getByText("Pass")).toHaveAttribute("data-tone", "bad");
  });

  it("explains a gated Pass right in the row", async () => {
    renderWithApi(<PipelineView />);
    const r = await screen.findByRole("row", { name: /Brightwater/ });
    expect(r).toHaveTextContent("EBITDA £7.1m is below the £10m mandate floor");
    const ok = screen.getByRole("row", { name: /Northvale/ });
    expect(ok).not.toHaveTextContent(/mandate floor/);
  });
});

describe("bar chart options for counts and short category lists", () => {
  it("integer axes never show fractional ticks", () => {
    const o = barOption({ categories: ["Teaser", "NDA"], series: [{ name: "Deals", values: [3, 1] }], orientation: "horizontal", integer: true }, theme) as Record<string, any>;
    expect(o.xAxis.minInterval).toBe(1);
  });

  it("vertical category axes show every label", () => {
    const o = barOption({ categories: ["TIC", "Compliance", "Payroll BPO", "IT & cyber"], series: [{ name: "Avg", values: [1, 2, 3, 4] }] }, theme) as Record<string, any>;
    expect(o.xAxis.axisLabel.interval).toBe(0);
  });
});
