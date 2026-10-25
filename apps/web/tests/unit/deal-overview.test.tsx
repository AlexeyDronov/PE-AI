/** Plan step 6.2: Deal overview (/deals/[id]) — design §5 "Deal". */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnThisPage } from "@/components/ui/OnThisPage";
import type { ResourceData } from "@/lib/api/types";
import { API, server } from "../setup/server";
import { FakeEventSource, renderWithApi } from "../setup/render";

const nav = { pathname: "/deals/d1" };
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
const { DealHeader } = await import("@/features/deal/DealHeader");
const { DealOverview } = await import("@/features/deal/DealOverview");

const DETAIL: ResourceData<"deal"> = {
  id: "d1",
  code_name: "Project Linden",
  stage: "CIM",
  ask_multiple: 15.5,
  process: "Banker-led auction, second round",
  origin: "seed",
  source: "seed",
  company_id: "c1",
  created_at: "2026-10-01T00:00:00Z",
  watchlisted: false,
  company: { name: "Northvale Compliance", hq: "London, UK", description: "Regulatory compliance outsourcing for banks.", segment_id: "s1" },
  segment: { id: "s1", name: "Compliance & regulatory services", short: "Compliance", median_multiple: 16 },
  financials: {
    id: "fin1", deal_id: "d1", source: "seed", revenue: 61, ebitda: 14.6, growth: 0.22, recurring_pct: 0.71, capex_pct: 0.03, da_pct: 0.04, nwc_pct: 0.06,
    top_customer_pct: 0.09, gross_retention: 0.93, cyclicality: "Low", ai_resilience: 72, fragmentation: 78,
    key_person_risk: false,
  },
  screening: {
    score: 81,
    verdict: "Advance",
    gate_reason: null,
    criteria: [
      { key: "scale", label: "Scale", value: 14.6, score: 100, weight: 0.1, target_text: "£10–60m" },
      { key: "margin", label: "EBITDA margin", value: 0.2393, score: 93.7, weight: 0.15, target_text: "≥ 18%" },
      { key: "entry_price", label: "Entry price", value: 0.03125, score: 57.8, weight: 0.1, target_text: "≤ segment median" },
    ],
  },
  risks: [
    { key: "concentration", label: "Customer concentration", status: "watch", detail: "Largest customer is 9% of revenue." },
    { key: "churn", label: "Churn", status: "clear", detail: "Gross revenue retention of 93%." },
    { key: "key_person", label: "Key person", status: "flag", detail: "Founder holds key relationships." },
  ],
  flags: [
    { id: "f1", deal_id: "d1", severity: "h", text: "Remediation projects are 29% of revenue.", mitigant: "Split run-rate from project revenue in the QoE.", source: "seed", created_at: "2026-10-01T00:00:00Z" },
  ],
  questions: ["What is net revenue retention on managed clients?", "How much of the stack is proprietary?"],
  debt_capacity: {
    ebitda: 14.6, senior_multiple: 3, policy_leverage: 4.5, rate_senior: 0.0875, rate_sub: 0.11, stress_drop: 0.225,
    cover_floor: 2, senior_debt: 43.8, total_debt: 65.7, interest: 6.24, interest_cover: 2.34, stressed_cover: 1.81,
    max_leverage: 4.14, max_debt: 60.4,
  },
};

let detail: ResourceData<"deal">;
let watchCalls: unknown[];

beforeEach(() => {
  nav.pathname = "/deals/d1";
  detail = structuredClone(DETAIL);
  watchCalls = [];
  server.use(
    http.get(`${API}/api/deals/d1`, () => HttpResponse.json(detail)),
    http.get(`${API}/api/funds`, () =>
      HttpResponse.json({ items: [{ id: "f1", name: "Harrowgate Fund VII", verdict_advance: 68, verdict_watch: 55 }], total: 1 }),
    ),
    http.get(`${API}/api/deals/missing`, () =>
      HttpResponse.json({ error: { code: "not_found", message: "Deal missing not found" } }, { status: 404 }),
    ),
    http.post(`${API}/api/commands/set-watchlist`, async ({ request }) => {
      const body = (await request.json()) as { deal_id: string; on: boolean };
      watchCalls.push(body);
      detail = { ...detail, watchlisted: body.on };
      return HttpResponse.json({ deal_id: body.deal_id, on: body.on, note: null });
    }),
  );
});

describe("DealHeader", () => {
  it("names the deal and shows where it stands", async () => {
    renderWithApi(<DealHeader dealId="d1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Northvale Compliance" })).toBeInTheDocument();
    const header = screen.getByTestId("deal-header");
    expect(header).toHaveTextContent("Project Linden");
    expect(header).toHaveTextContent("Compliance");
    expect(header).toHaveTextContent("London, UK");
    expect(within(header).getByText("CIM")).toBeInTheDocument();
    expect(within(header).getByText("Advance")).toHaveAttribute("data-tone", "good");
  });

  it("has Overview, Model and IC memo tabs linked to the deal's routes", async () => {
    renderWithApi(<DealHeader dealId="d1" />);
    const tabs = await screen.findByRole("tablist", { name: "Deal" });
    expect(within(tabs).getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(within(tabs).getByRole("tab", { name: "Model" })).toHaveAttribute("href", "/deals/d1/model");
    expect(within(tabs).getByRole("tab", { name: "IC memo" })).toHaveAttribute("href", "/deals/d1/memo");
  });

  it("marks the Model tab when on the model route", async () => {
    nav.pathname = "/deals/d1/model";
    renderWithApi(<DealHeader dealId="d1" />);
    expect(await screen.findByRole("tab", { name: "Model" })).toHaveAttribute("aria-selected", "true");
  });

  it("toggles the watchlist through the command and reflects it live", async () => {
    const user = userEvent.setup();
    renderWithApi(<DealHeader dealId="d1" />);
    await user.click(await screen.findByRole("button", { name: "Add to watchlist" }));
    expect(watchCalls).toEqual([{ deal_id: "d1", on: true }]);
    act(() => FakeEventSource.last?.emit("changed", { type: "changed", resources: ["deals"], ids: ["d1"] }));
    expect(await screen.findByRole("button", { name: "On watchlist" })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers building the model as the primary action", async () => {
    renderWithApi(<DealHeader dealId="d1" />);
    expect(await screen.findByRole("link", { name: "Build model" })).toHaveAttribute("href", "/deals/d1/model");
  });

  it("explains a gated verdict", async () => {
    detail = { ...detail, screening: { ...detail.screening, verdict: "Pass", gate_reason: "EBITDA £7.1m is below the £10m mandate floor" } };
    renderWithApi(<DealHeader dealId="d1" />);
    expect(await screen.findByText("EBITDA £7.1m is below the £10m mandate floor")).toBeInTheDocument();
  });

  it("shows a helpful not-found state", async () => {
    renderWithApi(<DealHeader dealId="missing" />);
    expect(await screen.findByText(/couldn.t find that deal/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to pipeline/i })).toHaveAttribute("href", "/deals");
  });
});

describe("DealOverview", () => {
  it("is five sections in summary-to-detail order, with an on-this-page navigator", async () => {
    renderWithApi(<DealOverview dealId="d1" />);
    const names = ["Snapshot", "Scorecard", "Risks", "Debt capacity", "Diligence questions"];
    for (const n of names) expect(await screen.findByRole("region", { name: n })).toBeInTheDocument();
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label") ?? r.querySelector("h2")?.textContent);
    expect(regions.filter((n) => n && names.includes(n))).toEqual(names);
    const toc = screen.getByRole("navigation", { name: "On this page" });
    expect(within(toc).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "#snapshot", "#scorecard", "#risks", "#debt-capacity", "#diligence-questions",
    ]);
  });

  it("snapshot shows score, EBITDA with margin, growth, recurring and ask vs segment median", async () => {
    renderWithApi(<DealOverview dealId="d1" />);
    const snap = await screen.findByRole("region", { name: "Snapshot" });
    await waitFor(() => expect(snap).toHaveTextContent("81"));
    expect(snap).toHaveTextContent("£14.6m");
    expect(snap).toHaveTextContent("23.9% margin");
    expect(snap).toHaveTextContent("22.0%");
    expect(snap).toHaveTextContent("71.0%");
    expect(snap).toHaveTextContent("15.5x");
    expect(snap).toHaveTextContent("Segment median 16.0x");
    expect(snap).toHaveTextContent("Regulatory compliance outsourcing for banks.");
  });

  it("scorecard lists each criterion with its formatted value, target and score bar", async () => {
    renderWithApi(<DealOverview dealId="d1" />);
    const card = await screen.findByRole("region", { name: "Scorecard" });
    const margin = await within(card).findByRole("row", { name: /EBITDA margin/ });
    expect(margin).toHaveTextContent("23.9%");
    expect(margin).toHaveTextContent("≥ 18%");
    expect(within(margin).getByRole("meter")).toHaveAttribute("aria-valuenow", "94");
    expect(within(card).getByRole("row", { name: /Scale/ })).toHaveTextContent("£14.6m");
    expect(within(card).getByRole("row", { name: /Entry price/ })).toHaveTextContent("3.1% below median");
  });

  it("risks show standard checks with status labels and company flags with mitigants", async () => {
    renderWithApi(<DealOverview dealId="d1" />);
    const risks = await screen.findByRole("region", { name: "Risks" });
    await within(risks).findByText("Customer concentration");
    expect(within(risks).getByText("Watch")).toHaveAttribute("data-tone", "warn");
    expect(within(risks).getByText("Clear")).toHaveAttribute("data-tone", "good");
    expect(within(risks).getByText("Flag")).toHaveAttribute("data-tone", "bad");
    expect(within(risks).getByText("High")).toHaveAttribute("data-tone", "bad");
    expect(risks).toHaveTextContent("Remediation projects are 29% of revenue.");
    expect(risks).toHaveTextContent("Split run-rate from project revenue in the QoE.");
  });

  it("debt capacity shows the policy structure and the stressed limit", async () => {
    renderWithApi(<DealOverview dealId="d1" />);
    const dc = await screen.findByRole("region", { name: "Debt capacity" });
    await waitFor(() => expect(dc).toHaveTextContent("£43.8m"));
    expect(dc).toHaveTextContent("£65.7m");
    expect(dc).toHaveTextContent("2.34x");
    expect(dc).toHaveTextContent("1.81x");
    expect(dc).toHaveTextContent("£60.4m");
    expect(dc).toHaveTextContent("4.14x");
  });

  it("lists the diligence questions in order", async () => {
    renderWithApi(<DealOverview dealId="d1" />);
    const q = await screen.findByRole("region", { name: "Diligence questions" });
    const items = await within(q).findAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(DETAIL.questions);
  });
});

describe("OnThisPage", () => {
  it("is a labelled list of anchor links", () => {
    render(<OnThisPage items={[{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]} />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(within(nav).getByRole("link", { name: "Beta" })).toHaveAttribute("href", "#b");
  });
});
