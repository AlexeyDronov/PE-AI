/** 8.11: research quality. The gap fill no longer depends on the model, partial answers are flagged, more pages are readable. No live network. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ApiCallbacks } from "@/callbacks";
import { jobRunners } from "@/jobs";
import { fetchPage } from "@/tools/fetchPage";
import { SYSTEM } from "@/workflows/marketResearch";
import "@/workflows";
import { API, testConfig } from "./helpers";
import { server } from "./setup";

const MESSAGES = "https://api.anthropic.com/v1/messages";
const SITE = "https://quality-research.co.uk";
// Built with tests/fixtures/make-pdf.mjs: "TIC deal multiples 2025" / "UK testing and inspection deals averaged 11.5x EBITDA in 2025." / "Cookie settings"
const PDF = readFileSync(fileURLToPath(new URL("./fixtures/report.pdf", import.meta.url)));

const page = (title: string, text: string) => `<html><head><title>${title}</title></head><body><main><p>${text}</p></main></body></html>`;
const PAGES: Record<string, string> = {
  "/a": page("UK compliance market", "The UK compliance outsourcing market reached £9.1bn in 2026, according to the annual survey."),
  "/b": page("Compliance growth", "Demand for compliance outsourcing is expected to grow 11% a year to 2030."),
  "/c": page("Bank spend", "Compliance outsourcing spend by banks rose to £2.4bn in 2025."),
  "/d": page("Insurer spend", "Compliance outsourcing spend by insurers rose to £1.2bn in 2025."),
  "/e": page("Asset manager spend", "Compliance outsourcing spend by asset managers rose to £0.8bn in 2025."),
};

interface Hit {
  path: string;
  raw?: string;
}
interface Calls {
  claude: Record<string, unknown>[];
  tavily: Record<string, unknown>[];
  rounds: string[][]; // queries searched before each Claude call
  pages: string[];
  result: { payload: Record<string, unknown> }[];
  fail: { error: string }[];
}

function harness(replies: Record<string, unknown>[], search: (query: string, calls: Calls) => Hit[]) {
  const calls: Calls = { claude: [], tavily: [], rounds: [[]], pages: [], result: [], fail: [] };
  server.use(
    http.post("https://api.tavily.com/search", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.tavily.push(body);
      calls.rounds[calls.claude.length]!.push(String(body.query));
      const hits = search(String(body.query), calls);
      return HttpResponse.json({
        results: hits.map((h, i) => ({ title: `Result ${h.path}`, url: `${SITE}${h.path}`, content: "snippet", score: 0.9 - i * 0.1, raw_content: h.raw ?? null })),
      });
    }),
    http.get(`${SITE}/robots.txt`, () => new HttpResponse("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } })),
    http.get(`${SITE}/:path`, ({ params }) => {
      const path = `/${params.path}`;
      calls.pages.push(path);
      if (path === "/report.pdf") return new HttpResponse(PDF, { headers: { "content-type": "application/pdf" } });
      if (path === "/blocked") return new HttpResponse("Forbidden", { status: 403 });
      const body = PAGES[path];
      return body ? new HttpResponse(body, { headers: { "content-type": "text/html" } }) : new HttpResponse(null, { status: 404 });
    }),
    // Each test uses its own segment, so the planned queries (and the tool cache) never overlap between tests.
    http.get(`${API}/api/segments/:id`, ({ params }) => HttpResponse.json({ id: params.id, short: `Segment ${String(params.id)}`, name: "Compliance" })),
    http.post(MESSAGES, async ({ request }) => {
      calls.claude.push((await request.json()) as Record<string, unknown>);
      calls.rounds.push([]);
      return HttpResponse.json(replies[Math.min(calls.claude.length - 1, replies.length - 1)]);
    }),
    http.post(`${API}/internal/jobs/:id/:action`, async ({ params, request }) => {
      const body = await request.json();
      if (params.action === "result") calls.result.push(body as Calls["result"][number]);
      if (params.action === "fail") calls.fail.push(body as Calls["fail"][number]);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

const claude = (data: unknown) => ({
  id: "msg_q",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5-5",
  content: [{ type: "text", text: JSON.stringify(data) }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 4000, cache_creation_input_tokens: 0, cache_read_input_tokens: 1500, output_tokens: 800 },
});

const SIZE = {
  metric: "UK compliance outsourcing market size",
  value: 9.1,
  unit: "£bn",
  period: "2026",
  confidence: "medium",
  source_refs: [1],
  quote: "The UK compliance outsourcing market reached £9.1bn in 2026",
};
const GROWTH = { ...SIZE, metric: "Growth to 2030", value: 11, unit: "% a year", period: "2026-30", source_refs: [2], quote: "expected to grow 11% a year to 2030" };

async function run(question: string, segment_id: string) {
  const config = testConfig();
  await jobRunners.market_research!("job-q", { question, segment_id }, { config, callbacks: new ApiCallbacks(config) });
}

const textOf = (body: Record<string, unknown>) => JSON.stringify(body.messages);
const firstRound = (calls: Calls) => calls.claude.length === 0;

describe("gap fill that does not depend on the model", () => {
  it("searches planned queries it has not used yet when the answer is thin and Claude suggests nothing", async () => {
    const unanswered = claude({ summary: "Partial.", answered: false, findings: [SIZE, GROWTH], follow_up_queries: [] });
    const filled = claude({ summary: "Answered.", answered: true, findings: [SIZE, GROWTH], follow_up_queries: [] });
    const calls = harness([unanswered, filled], (_q, c) => (firstRound(c) ? [{ path: "/a" }, { path: "/b" }] : [{ path: "/c" }]));
    await run("How big is the UK compliance outsourcing market? (q1)", "segq1");
    expect(calls.fail).toEqual([]);
    expect(calls.claude).toHaveLength(2);
    const [first, gap] = calls.rounds as [string[], string[]];
    expect(gap.length).toBeGreaterThanOrEqual(1);
    expect(gap.length).toBeLessThanOrEqual(2);
    for (const q of gap) expect(first).not.toContain(q);
    expect(gap.join(" ")).toContain("Segment segq1"); // planned template queries, not the model's
    expect(textOf(calls.claude[1]!)).toContain("£2.4bn");
    expect(calls.result[0]!.payload.summary).toBe("Answered.");
  });

  it("does at most two gap rounds, so at most three Claude calls", async () => {
    const thin = (n: number) => claude({ summary: `Thin ${n}.`, answered: false, findings: [SIZE], follow_up_queries: [`gap query ${n}`] });
    const byQuery: Record<string, Hit[]> = { "gap query 1": [{ path: "/c" }], "gap query 2": [{ path: "/d" }], "gap query 3": [{ path: "/e" }] };
    const calls = harness([thin(1), thin(2), thin(3)], (q) => byQuery[q] ?? [{ path: "/a" }, { path: "/b" }]);
    await run("How big is the UK compliance outsourcing market? (q2)", "segq2");
    expect(calls.claude).toHaveLength(3);
    expect(calls.tavily.map((b) => b.query)).not.toContain("gap query 3");
    expect(textOf(calls.claude[2]!)).toContain("£1.2bn");
    expect(calls.result[0]!.payload.summary).toBe("Thin 3.");
  });

  it("stops without another Claude call when a gap round finds nothing new to read", async () => {
    const thin = claude({ summary: "Thin.", answered: false, findings: [SIZE], follow_up_queries: ["nothing new"] });
    const calls = harness([thin], () => [{ path: "/a" }, { path: "/b" }]);
    await run("How big is the UK compliance outsourcing market? (q3)", "segq3");
    expect(calls.claude).toHaveLength(1);
    expect(calls.result).toHaveLength(1);
  });
});

describe("partial answers are flagged", () => {
  it("reports answered: false and the model when the sources do not answer the question", async () => {
    const reply = claude({ summary: "Closest evidence is the market size.", answered: false, findings: [SIZE, GROWTH], follow_up_queries: [] });
    const calls = harness([reply], () => [{ path: "/a" }, { path: "/b" }]);
    await run("What multiples are paid for UK compliance outsourcers? (q4)", "segq4");
    const { payload } = calls.result[0]!;
    expect(payload.answered).toBe(false);
    expect(payload.model).toBe("claude-sonnet-5-5");
  });

  it("reports answered: true when the sources answer it", async () => {
    const reply = claude({ summary: "£9.1bn.", answered: true, findings: [SIZE, GROWTH], follow_up_queries: [] });
    const calls = harness([reply], () => [{ path: "/a" }, { path: "/b" }]);
    await run("How big is the UK compliance outsourcing market? (q5)", "segq5");
    expect(calls.result[0]!.payload.answered).toBe(true);
  });

  it("tells Claude to lead with what was found rather than opening with 'Not found'", () => {
    expect(SYSTEM).toMatch(/never (begin|open|start) the summary with "not found"/i);
  });
});

describe("more readable sources", () => {
  it("searches at advanced depth with 8 results and Tavily's page text, reading at most 8 pages", async () => {
    const many: Hit[] = ["/a", "/b", "/c", "/d", "/e", "/f", "/g", "/h", "/i", "/j"].map((path) => ({ path }));
    const calls = harness([claude({ summary: "s", answered: true, findings: [SIZE, GROWTH], follow_up_queries: [] })], () => many);
    await run("How big is the UK compliance outsourcing market and how fast is it growing? (q6)", "segq6");
    expect(calls.tavily.length).toBeGreaterThan(0);
    expect(calls.tavily.length).toBeLessThanOrEqual(4);
    for (const body of calls.tavily) expect(body).toMatchObject({ search_depth: "advanced", max_results: 8, include_raw_content: true });
    expect(new Set(calls.pages).size).toBeLessThanOrEqual(8);
  });

  it("uses Tavily's page text when the page itself cannot be fetched", async () => {
    const blocked = { path: "/blocked", raw: "Compliance outsourcing spend by pension funds reached £3.3bn in 2025." };
    const calls = harness([claude({ summary: "s", answered: true, findings: [SIZE, GROWTH], follow_up_queries: [] })], () => [{ path: "/a" }, { path: "/b" }, blocked]);
    await run("How big is the UK compliance outsourcing market? (q7)", "segq7");
    expect(calls.pages).toContain("/blocked");
    expect(textOf(calls.claude[0]!)).toContain("£3.3bn");
    expect(textOf(calls.claude[0]!)).toContain(`${SITE}/blocked`);
  });

  it("reads PDF reports", async () => {
    const calls = harness([claude({ summary: "s", answered: true, findings: [SIZE, GROWTH], follow_up_queries: [] })], () => [{ path: "/a" }, { path: "/b" }, { path: "/report.pdf" }]);
    await run("What EBITDA multiples are paid for UK testing and inspection businesses? (q8)", "segq8");
    expect(textOf(calls.claude[0]!)).toContain("11.5x EBITDA");
  });
});

describe("fetchPage reads PDFs", () => {
  it("returns the text of a PDF", async () => {
    server.use(
      http.get(`${SITE}/robots.txt`, () => new HttpResponse("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } })),
      http.get(`${SITE}/report.pdf`, () => new HttpResponse(PDF, { headers: { "content-type": "application/pdf" } })),
    );
    const out = await fetchPage({ url: `${SITE}/report.pdf`, maxChars: 5000 });
    expect(out.text).toContain("UK testing and inspection deals averaged 11.5x EBITDA in 2025.");
    expect(out.truncated).toBe(false);
  });

  it("truncates long PDFs", async () => {
    server.use(
      http.get(`${SITE}/robots.txt`, () => new HttpResponse("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } })),
      http.get(`${SITE}/report.pdf`, () => new HttpResponse(PDF, { headers: { "content-type": "application/pdf" } })),
    );
    const out = await fetchPage({ url: `${SITE}/report.pdf`, maxChars: 20 });
    expect(out.text.length).toBeLessThanOrEqual(20);
    expect(out.truncated).toBe(true);
  });
});
