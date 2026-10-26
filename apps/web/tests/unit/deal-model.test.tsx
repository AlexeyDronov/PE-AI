/** Plan step 6.3: Deal model (/deals/[id]/model) — design §5 "Deal → Model". */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiDownload } from "@/lib/api/client";
import { API, server } from "../setup/server";
import { FakeEventSource, renderWithApi } from "../setup/render";

const nav = { pathname: "/deals/d1/model", search: "", replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: nav.replace, prefetch: vi.fn() }),
}));
const inst = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock("@/components/charts/loadEcharts", () => ({ loadEcharts: async () => ({ init: vi.fn(() => inst) }) }));
const { DealModel } = await import("@/features/deal/DealModel");

const year = (n: number, rev: number, ebitda: number, fcf: number, senior: number) => ({
  year: n, revenue: rev, margin: ebitda / rev, ebitda, da: 2, capex: 2, nwc: 1, interest: 6.2, tax: 2.1,
  free_cash_flow: fcf, repayment: fcf * 0.75, senior_close: senior, sub_close: 21.9, cash: 3,
});

function lboResponse(entry: number, irr = 0.203) {
  return {
    case: "base",
    hurdle: 0.2,
    assumptions: {
      revenue0: 61, ebitda0: 14.6, entry_multiple: entry, exit_multiple: 15.5, total_leverage: 4.5, senior_leverage: 3,
      rate_senior: 0.0875, rate_sub: 0.11, tx_fee_pct: 0.02, fin_fee_pct: 0.025, min_cash: 2, tax_rate: 0.25,
      revenue_growth: [0.22, 0.19, 0.16, 0.14, 0.11], margin_change_bp: 0, capex_pct: 0.03, da_pct: 0.04, nwc_pct: 0.06,
      sweep: 0.75, mgmt_rollover: 0.1, years: 5,
    },
    sources_uses: {
      enterprise_value: 226.3, transaction_fees: 4.5, financing_fees: 1.6, min_cash: 2, total_uses: 234.4,
      senior_debt: 43.8, sub_debt: 21.9, rollover_equity: 16.9, sponsor_equity: 151.8, total_sources: 234.4,
    },
    schedule: [year(1, 74.4, 17.8, 6.5, 38.9), year(2, 88.5, 21.2, 8.7, 32.4), year(3, 102.7, 24.6, 11.2, 24.0), year(4, 117.1, 28.0, 14.1, 13.4), year(5, 130.0, 31.1, -1.2, 13.4)],
    returns: { exit_ev: 482, exit_net_debt: 32.3, exit_equity: 449.7, sponsor_exit_equity: 404.7, moic: 2.52, irr },
    credit: { total_leverage: 4.5, senior_leverage: 3, interest_cover: 2.75, debt_share: 0.3, stressed_cover: 2.13 },
    bridge: [
      { label: "Entry equity", value: 168.7 }, { label: "EBITDA growth", value: 255.1 }, { label: "Multiple", value: 0 },
      { label: "Debt paydown and cash", value: 32.0 }, { label: "Fees", value: -6.1 }, { label: "Exit equity", value: 449.7 },
    ],
    max_bid: { multiple: 15.7, enterprise_value: 229.2 },
  };
}

let lboBodies: { deal_id: string; case?: string; overrides?: Record<string, number> }[];
let sensitivityBodies: unknown[];
let scenarios: { id: string; deal_id: string; name: string; case: string; overrides: Record<string, number> }[];

beforeEach(() => {
  nav.search = "";
  nav.replace.mockClear();
  lboBodies = [];
  sensitivityBodies = [];
  scenarios = [];
  server.use(
    http.post(`${API}/api/compute/lbo`, async ({ request }) => {
      const body = (await request.json()) as (typeof lboBodies)[number];
      lboBodies.push(body);
      return HttpResponse.json(lboResponse(body.overrides?.entry_multiple ?? 15.5, body.case === "down" ? 0.14 : 0.203));
    }),
    http.post(`${API}/api/compute/lbo-sensitivity`, async ({ request }) => {
      sensitivityBodies.push(await request.json());
      return HttpResponse.json({ entry: [13.5, 14.5, 15.5, 16.5, 17.5], exit: [13.5, 14.5, 15.5, 16.5, 17.5], irr: Array.from({ length: 5 }, () => [0.25, 0.23, 0.2, 0.18, 0.16]) });
    }),
    http.post(`${API}/api/compute/valuation-range`, () =>
      HttpResponse.json({ ask: 226.3, rows: [{ label: "Trading comps", low: 219, high: 248.2 }, { label: "Precedent transactions", low: 190, high: 240 }, { label: "LBO at 20–25% IRR", low: 200, high: 229.2 }] }),
    ),
    http.get(`${API}/api/lbo-scenarios`, () => HttpResponse.json({ items: scenarios, total: scenarios.length })),
    http.post(`${API}/api/commands/save-scenario`, async ({ request }) => {
      const b = (await request.json()) as Omit<(typeof scenarios)[number], "id">;
      const s = { id: `s${scenarios.length + 1}`, ...b };
      scenarios = [...scenarios, s];
      return HttpResponse.json({ ...s, created_at: "2026-10-25T00:00:00Z", source: "user" }, { status: 201 });
    }),
    http.get(`${API}/api/benchmarks`, () =>
      HttpResponse.json({ items: [{ id: "b1", key: "total_leverage", label: "Total leverage", low: 5, high: 7, unit: "x" }, { id: "b2", key: "interest_cover", label: "Interest cover", low: 2, high: null, unit: "x" }], total: 2 }),
    ),
  );
});

describe("DealModel", () => {
  it("is five sections in order with an on-this-page navigator", async () => {
    renderWithApi(<DealModel dealId="d1" />);
    const names = ["Returns", "Assumptions and structure", "Projections", "Sensitivity", "Value bridge"];
    for (const n of names) expect(await screen.findByRole("region", { name: n })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "On this page" })).getAllByRole("link")).toHaveLength(5);
  });

  it("returns strip leads with IRR against the hurdle, then MOIC, equity cheque and max bid", async () => {
    renderWithApi(<DealModel dealId="d1" />);
    const r = await screen.findByRole("region", { name: "Returns" });
    await waitFor(() => expect(r).toHaveTextContent("20.3%"));
    expect(r).toHaveTextContent("0.3pt above the 20% hurdle");
    expect(r).toHaveTextContent("2.52x");
    expect(r).toHaveTextContent("£151.8m");
    expect(r).toHaveTextContent("£229.2m");
    expect(r).toHaveTextContent("15.7x EBITDA");
  });

  it("flags returns below the hurdle", async () => {
    nav.search = "case=down";
    renderWithApi(<DealModel dealId="d1" />);
    const r = await screen.findByRole("region", { name: "Returns" });
    await waitFor(() => expect(r).toHaveTextContent("6.0pt below the 20% hurdle"));
    expect(within(r).getByTestId("stat-delta")).toHaveAttribute("data-tone", "bad");
  });

  it("keeps the case in the URL and sends it to the model", async () => {
    const user = userEvent.setup();
    renderWithApi(<DealModel dealId="d1" />);
    await screen.findByRole("region", { name: "Returns" });
    await user.click(screen.getByRole("button", { name: "Downside" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/deals/d1/model?case=down", { scroll: false });
    nav.search = "case=down";
  });

  it("recomputes from slider overrides, debounced, keeping the last result on screen", async () => {
    renderWithApi(<DealModel dealId="d1" />);
    const slider = await screen.findByRole("slider", { name: "Entry EV / EBITDA" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "15.5"));
    const before = lboBodies.length;
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(screen.getByRole("region", { name: "Returns" })).toHaveTextContent("20.3%");
    await waitFor(() => expect(lboBodies.at(-1)?.overrides?.entry_multiple).toBe(16.5));
    expect(lboBodies.length - before).toBe(1);
    expect(sensitivityBodies.at(-1)).toMatchObject({ overrides: { entry_multiple: 16.5 } });
  });

  it("has sliders for the six levers, formatted as inputs", async () => {
    renderWithApi(<DealModel dealId="d1" />);
    for (const name of ["Entry EV / EBITDA", "Exit EV / EBITDA", "Total leverage", "Revenue growth, year 1", "Margin change per year", "Management rollover"]) {
      expect(await screen.findByRole("slider", { name })).toBeInTheDocument();
    }
    await waitFor(() => expect(screen.getByRole("slider", { name: "Revenue growth, year 1" })).toHaveAttribute("aria-valuetext", "22%"));
    expect(screen.getByRole("slider", { name: "Margin change per year" })).toHaveAttribute("aria-valuetext", "+0bp");
  });

  it("resets overrides to the case defaults, reusing their cached result", async () => {
    const user = userEvent.setup();
    renderWithApi(<DealModel dealId="d1" />);
    const slider = await screen.findByRole("slider", { name: "Entry EV / EBITDA" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "15.5"));
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    await waitFor(() => expect(lboBodies.at(-1)?.overrides?.entry_multiple).toBe(16));
    const requests = lboBodies.length;
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "15.5"));
    // The defaults were computed on load and are still cached, so going back to them costs no request.
    expect(lboBodies[0]?.overrides ?? {}).toEqual({});
    await new Promise((r) => setTimeout(r, 300));
    expect(lboBodies).toHaveLength(requests);
  });

  it("shows sources and uses, and credit stats against benchmarks", async () => {
    renderWithApi(<DealModel dealId="d1" />);
    const s = await screen.findByRole("region", { name: "Assumptions and structure" });
    await waitFor(() => expect(s).toHaveTextContent("226.3"));
    expect(s).toHaveTextContent("Total uses");
    expect(s).toHaveTextContent("234.4");
    expect(s).toHaveTextContent("Senior debt");
    expect(s).toHaveTextContent("Sponsor equity");
    expect(s).toHaveTextContent("4.50x");
    expect(s).toHaveTextContent("Benchmark 5.0–7.0x");
    expect(s).toHaveTextContent("2.75x");
  });

  it("projects five years with financial formatting", async () => {
    renderWithApi(<DealModel dealId="d1" />);
    const p = await screen.findByRole("region", { name: "Projections" });
    const table = await within(p).findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["£m", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5"]);
    const fcf = within(table).getByRole("row", { name: /Free cash flow/ });
    expect(fcf).toHaveTextContent("(1.2)");
    expect(within(table).getByRole("row", { name: /EBITDA margin/ })).toHaveTextContent("23.9%");
  });

  it("charts sensitivity, valuation range and the value bridge", async () => {
    renderWithApi(<DealModel dealId="d1" />);
    expect(await screen.findByRole("img", { name: "IRR by entry and exit multiple" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Valuation range" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("region", { name: "Sensitivity" })).toHaveTextContent("Marker shows the ask of £226.3m"));
    expect(screen.getByRole("img", { name: "Equity value bridge" })).toBeInTheDocument();
  });

  it("saves the current scenario and can load it back", async () => {
    const user = userEvent.setup();
    renderWithApi(<DealModel dealId="d1" />);
    const slider = await screen.findByRole("slider", { name: "Entry EV / EBITDA" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "15.5"));
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    await user.click(screen.getByRole("button", { name: "Save scenario" }));
    await user.type(screen.getByLabelText("Scenario name"), "Bid at 15x");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(scenarios).toHaveLength(1));
    expect(scenarios[0]).toMatchObject({ deal_id: "d1", name: "Bid at 15x", case: "base", overrides: { entry_multiple: 15 } });
    act(() => FakeEventSource.last?.emit("changed", { type: "changed", resources: ["lbo-scenarios"], ids: ["s1"] }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(await screen.findByRole("button", { name: "Load Bid at 15x" }));
    await waitFor(() => expect(lboBodies.at(-1)?.overrides).toEqual({ entry_multiple: 15 }));
  }, 15_000);

  it("exports the current model to Excel", async () => {
    let exported: unknown;
    server.use(
      http.post(`${API}/api/exports/lbo`, async ({ request }) => {
        exported = await request.json();
        return new HttpResponse(new Blob(["xlsx"]), {
          headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": 'attachment; filename="northvale-compliance-lbo-base.xlsx"' },
        });
      }),
    );
    const created = vi.fn(() => "blob:x");
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    renderWithApi(<DealModel dealId="d1" />);
    await screen.findByRole("region", { name: "Returns" });
    await user.click(screen.getByRole("button", { name: "Export Excel" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(exported).toMatchObject({ deal_id: "d1", case: "base" });
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("northvale-compliance-lbo-base.xlsx");
  });

  it("hands off to the IC memo as the primary next step", async () => {
    renderWithApi(<DealModel dealId="d1" />);
    expect(await screen.findByRole("link", { name: "Draft IC memo" })).toHaveAttribute("href", "/deals/d1/memo");
  });
});

describe("apiDownload", () => {
  it("returns the blob and the server's filename", async () => {
    server.use(
      http.post(`${API}/api/exports/x`, () =>
        new HttpResponse("abc", { headers: { "content-disposition": 'attachment; filename="a b.xlsx"' } }),
      ),
    );
    const out = await apiDownload(API, "/exports/x", { a: 1 });
    expect(out.filename).toBe("a b.xlsx");
    expect(await out.blob.text()).toBe("abc");
  });

  it("raises ApiError with the server error shape", async () => {
    server.use(
      http.post(`${API}/api/exports/x`, () =>
        HttpResponse.json({ error: { code: "invalid_assumptions", message: "Senior above total" } }, { status: 422 }),
      ),
    );
    await expect(apiDownload(API, "/exports/x", {})).rejects.toMatchObject({ code: "invalid_assumptions", status: 422 });
  });
});
