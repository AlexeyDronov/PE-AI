/** Plan step 6.13: Research (/research) — design §5 "Research". */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API, server } from "../setup/server";
import { renderWithApi } from "../setup/render";

const nav = { search: "", replace: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/research",
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, prefetch: vi.fn() }),
}));
const { ResearchView } = await import("@/features/research/ResearchView");

const report = (id: string, question: string, created_at: string) => ({
  id, question, created_at, source: "agent", segment_id: "s2", status: "complete", summary: `Summary for ${question}`,
});
const REPORTS = [
  report("r2", "How fast is UK compliance outsourcing growing?", "2026-10-27T10:00:00Z"),
  report("r1", "What multiples do TIC deals trade at?", "2026-10-20T10:00:00Z"),
];
const DETAIL = {
  ...REPORTS[0],
  summary: "No source sizes the outsourced market directly; the nearest proxy is UK eGRC.",
  findings: [
    { id: "f1", report_id: "r2", metric: "UK eGRC market revenue", value: 4738.7, unit: "US$m", period: "2025", confidence: "low", refs: [1], source_ids: ["x1"], source: "agent", created_at: "" },
    { id: "f2", report_id: "r2", metric: "UK eGRC growth rate", value: 10.9, unit: "% a year", period: "2026-2033", confidence: "medium", refs: [1, 2], source_ids: ["x1", "x2"], source: "agent", created_at: "" },
  ],
  sources: [
    { ref: 1, id: "x1", url: "https://www.grandviewresearch.com/egrc", title: "UK eGRC market outlook", publisher: "grandviewresearch.com", excerpt: "The UK eGRC market generated USD 4,738.7 million in 2025.", retrieved_at: "2026-10-27T10:00:00Z" },
    { ref: 2, id: "x2", url: "https://www.kbvresearch.com/caas", title: "Europe CaaS market", publisher: "kbvresearch.com", excerpt: "Growth of 10.9% a year.", retrieved_at: "2026-10-27T10:00:00Z" },
  ],
};
const SEGMENTS = [
  { id: "s1", short: "TIC", name: "Testing, inspection & certification" },
  { id: "s2", short: "Compliance", name: "Compliance & regulatory services" },
];
const job = (over: Record<string, unknown> = {}) => ({
  id: "j7", kind: "market_research", status: "running", input: {}, result_ref: null, error: null, usage: null,
  progress: [{ step: "search", message: "Searching and reading sources", at: "" }], created_at: "", updated_at: "", source: "user", ...over,
});

let starts: unknown[];
let listParams: URLSearchParams[];
let jobState: ReturnType<typeof job>;

beforeEach(() => {
  nav.search = "";
  nav.replace.mockClear();
  starts = [];
  listParams = [];
  jobState = job();
  server.use(
    http.get(`${API}/api/segments`, () => HttpResponse.json({ items: SEGMENTS, total: 2 })),
    http.get(`${API}/api/research-reports`, ({ request }) => {
      listParams.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items: REPORTS, total: 2 });
    }),
    http.get(`${API}/api/research-reports/r2`, () => HttpResponse.json(DETAIL)),
    http.post(`${API}/api/commands/start-market-research`, async ({ request }) => {
      starts.push(await request.json());
      return HttpResponse.json(job({ status: "queued", progress: [] }), { status: 202 });
    }),
    http.get(`${API}/api/jobs/j7`, () => HttpResponse.json(jobState)),
  );
});

describe("Research", () => {
  it("lists reports newest first", async () => {
    renderWithApi(<ResearchView />);
    const list = await screen.findByTestId("report-list");
    await waitFor(() => expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("How fast is UK compliance outsourcing growing?"),
      expect.stringContaining("What multiples do TIC deals trade at?"),
    ]));
    expect(listParams[0]?.get("sort")).toBe("-created_at");
  });

  it("opens a report into the URL, showing its summary, findings with refs, and numbered sources", async () => {
    const user = userEvent.setup();
    const view = renderWithApi(<ResearchView />);
    await user.click(await screen.findByRole("button", { name: /How fast is UK compliance/ }));
    expect(nav.replace).toHaveBeenCalledWith("/research?report=r2", { scroll: false });

    nav.search = "report=r2";
    view.rerender(<ResearchView />);
    const detail = await screen.findByTestId("report-detail");
    await waitFor(() => expect(detail).toHaveTextContent("nearest proxy is UK eGRC"));
    const findings = within(detail).getByTestId("findings-table");
    expect(findings).toHaveTextContent("UK eGRC market revenue");
    expect(findings).toHaveTextContent("4,738.7 US$m");
    expect(findings).toHaveTextContent("[1, 2]");
    expect(findings).toHaveTextContent(/medium/i);
    const sources = within(detail).getByTestId("source-list");
    expect(within(sources).getAllByRole("listitem")).toHaveLength(2);
    const link = within(sources).getByRole("link", { name: "UK eGRC market outlook" });
    expect(link).toHaveAttribute("href", "https://www.grandviewresearch.com/egrc");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(sources).toHaveTextContent("grandviewresearch.com");
  });

  it("runs new research for a chosen segment and shows progress", async () => {
    const user = userEvent.setup();
    renderWithApi(<ResearchView />);
    await user.type(await screen.findByLabelText(/research question/i), "How big is UK compliance outsourcing?");
    await user.selectOptions(screen.getByLabelText(/segment/i), "s2");
    await user.click(screen.getByRole("button", { name: "Run research" }));
    await waitFor(() => expect(starts).toEqual([{ question: "How big is UK compliance outsourcing?", segment_id: "s2" }]));
    expect(await screen.findByTestId("research-progress")).toHaveTextContent(/searching and reading sources/i);
  });

  it("sends no segment when 'All segments' is chosen", async () => {
    const user = userEvent.setup();
    renderWithApi(<ResearchView />);
    await user.type(await screen.findByLabelText(/research question/i), "Which sponsors are active in UK services?");
    await user.click(screen.getByRole("button", { name: "Run research" }));
    await waitFor(() => expect(starts).toEqual([{ question: "Which sponsors are active in UK services?", segment_id: null }]));
  });

  it("opens the new report when the run finishes and shows what it cost", async () => {
    jobState = job({ status: "succeeded", result_ref: "r2", usage: { calls: 1, inputTokens: 6898, cacheWriteTokens: 3119, cacheReadTokens: 0, outputTokens: 3493, costUsd: 0.0028 } });
    const user = userEvent.setup();
    renderWithApi(<ResearchView />);
    await user.type(await screen.findByLabelText(/research question/i), "How big is UK compliance outsourcing?");
    await user.click(screen.getByRole("button", { name: "Run research" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/research?report=r2", { scroll: false }));
    expect(screen.getByTestId("research-progress")).toHaveTextContent(/\$0\.0028/);
  });

  it("shows an empty state when there is no research yet", async () => {
    server.use(http.get(`${API}/api/research-reports`, () => HttpResponse.json({ items: [], total: 0 })));
    renderWithApi(<ResearchView />);
    expect(await screen.findByText(/no research yet/i)).toBeInTheDocument();
  });
});
