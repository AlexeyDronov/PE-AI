/** 7.6: marketResearch workflow. Code searches, fetches, filters and verifies; Claude is called once, at most twice. No live network. */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ApiCallbacks } from "@/callbacks";
import { jobRunners } from "@/jobs";
import "@/workflows";
import { API, testConfig } from "./helpers";
import { server } from "./setup";

const MESSAGES = "https://api.anthropic.com/v1/messages";
const SITE = "https://example-research.co.uk";

const page = (title: string, paragraphs: string[]) =>
  `<html><head><title>${title}</title></head><body><nav>Home | About</nav><main>${paragraphs.map((p) => `<p>${p}</p>`).join("")}</main></body></html>`;

const PAGES: Record<string, string> = {
  "/a": page("UK compliance market 2026", [
    "The UK compliance outsourcing market reached £9.1bn in 2026, according to the annual survey.",
    "Cookie settings and newsletter sign-up.",
  ]),
  "/b": page("Compliance growth outlook", ["Demand for compliance outsourcing is expected to grow 11% a year to 2030."]),
  "/c": page("Extra source", ["Compliance outsourcing spend by banks rose to £2.4bn in 2025."]),
};

interface Calls {
  claude: Record<string, unknown>[];
  tavily: Record<string, unknown>[];
  pages: string[];
  result: { payload: Record<string, unknown>; usage: Record<string, unknown> }[];
  fail: { error: string }[];
}

type Search = (query: string, n: number) => string[];

function harness(replies: Record<string, unknown>[], search: Search = () => ["/a", "/b"]) {
  const calls: Calls = { claude: [], tavily: [], pages: [], result: [], fail: [] };
  server.use(
    http.post("https://api.tavily.com/search", async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.tavily.push(body);
      const paths = search(String(body.query), calls.tavily.length - 1);
      return HttpResponse.json({
        results: paths.map((p, i) => ({ title: `Result ${p}`, url: `${SITE}${p}`, content: "snippet", score: 0.9 - i * 0.1 })),
      });
    }),
    http.get(`${SITE}/robots.txt`, () => new HttpResponse("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } })),
    http.get(`${SITE}/:path`, ({ params }) => {
      calls.pages.push(`/${params.path}`);
      const body = PAGES[`/${params.path}`];
      return body ? new HttpResponse(body, { headers: { "content-type": "text/html" } }) : new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API}/api/segments/:id`, ({ params }) =>
      HttpResponse.json(
        params.id === "seg2"
          ? { id: "seg2", short: "Legal ops", name: "Legal & professional outsourcing" }
          : { id: "seg1", short: "Compliance", name: "Compliance & regulatory services" },
      ),
    ),
    http.post(MESSAGES, async ({ request }) => {
      calls.claude.push((await request.json()) as Record<string, unknown>);
      const reply = replies[Math.min(calls.claude.length - 1, replies.length - 1)];
      return HttpResponse.json(reply);
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
  id: "msg_r",
  type: "message",
  role: "assistant",
  model: "claude-haiku-5-5",
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
const GROWTH = {
  metric: "Growth to 2030",
  value: 11,
  unit: "% a year",
  period: "2026-30",
  confidence: "low",
  source_refs: [2],
  quote: "expected to grow 11% a year to 2030",
};
const INVENTED = { ...GROWTH, metric: "Number of providers", value: 340, unit: "firms", quote: "There are 340 providers" };

async function run(question: string, segment_id: string | null = "seg1") {
  const config = testConfig();
  expect(jobRunners.market_research).toBeTypeOf("function");
  await jobRunners.market_research!("job-r", { question, segment_id }, { config, callbacks: new ApiCallbacks(config) });
}

const textOf = (body: Record<string, unknown>) => JSON.stringify(body.messages);

describe("marketResearch workflow", () => {
  it("researches with one Claude call when evidence is sufficient, posting verified findings and cited sources", async () => {
    const calls = harness([claude({ summary: "Large, growing market.", findings: [SIZE, GROWTH, INVENTED], follow_up_queries: [] })]);
    await run("How big is the UK compliance outsourcing market? (case 1)");
    expect(calls.fail).toEqual([]);
    expect(calls.claude).toHaveLength(1);
    const [{ payload, usage }] = calls.result as [Calls["result"][number]];
    expect(payload.summary).toBe("Large, growing market.");
    const findings = payload.findings as Record<string, unknown>[];
    expect(findings.map((f) => f.metric)).toEqual([SIZE.metric, GROWTH.metric]); // the invented figure is dropped by code
    expect(findings[0]).not.toHaveProperty("quote");
    const sources = payload.sources as { ref: number; url: string; publisher: string; excerpt: string }[];
    expect(sources.map((s) => s.ref).sort()).toEqual([1, 2]);
    expect(sources.find((s) => s.ref === 1)).toMatchObject({ url: `${SITE}/a`, publisher: "example-research.co.uk" });
    expect(sources.find((s) => s.ref === 1)!.excerpt).toContain("£9.1bn");
    expect(usage).toMatchObject({ calls: 1 });
  });

  it("sends Claude filtered, numbered sources and a frozen system prompt", async () => {
    const calls = harness([claude({ summary: "s", findings: [SIZE, GROWTH], follow_up_queries: [] })]);
    await run("How big is the UK compliance outsourcing market? (case 2)");
    const body = calls.claude[0]!;
    expect(textOf(body)).toContain("[1]");
    expect(textOf(body)).toContain("£9.1bn");
    expect(textOf(body)).not.toMatch(/Cookie settings|Home \| About/);
    const system = (body.system as { text: string }[]).map((b) => b.text).join("");
    expect(system).not.toContain("case 2");
    expect(system.length).toBeGreaterThan(2500);
    // Raised with the teaser cap: research output plus adaptive thinking needs headroom.
    expect(body.max_tokens).toBe(8000);
  });

  it("searches cheaply: basic depth, 5 results, at most 4 queries, at most 6 pages", async () => {
    const many = [["/a", "/b", "/c", "/d", "/e"], ["/f", "/g", "/a"], ["/h"], ["/i"]];
    const calls = harness([claude({ summary: "s", findings: [SIZE, GROWTH], follow_up_queries: [] })], (_q, n) => many[Math.min(n, 3)]!);
    await run("How big is the UK compliance outsourcing market and how fast is it growing? (case 3)");
    expect(calls.tavily.length).toBeGreaterThan(0);
    expect(calls.tavily.length).toBeLessThanOrEqual(4);
    for (const body of calls.tavily) expect(body).toMatchObject({ search_depth: "basic", max_results: 5 });
    expect(new Set(calls.pages).size).toBeLessThanOrEqual(6);
  });

  it("does one bounded gap-fill when evidence is thin, then stops", async () => {
    const thin = claude({ summary: "Thin.", findings: [SIZE], follow_up_queries: ["UK bank compliance outsourcing spend 2025"] });
    const filled = claude({
      summary: "Filled.",
      findings: [SIZE, { ...SIZE, metric: "Bank spend", value: 2.4, period: "2025", source_refs: [3], quote: "spend by banks rose to £2.4bn in 2025" }],
      follow_up_queries: ["yet another query"],
    });
    const calls = harness([thin, filled], (q) => (q.includes("bank compliance") ? ["/c"] : ["/a", "/b"]));
    await run("How big is the UK compliance outsourcing market? (case 4)");
    expect(calls.claude).toHaveLength(2);
    expect(textOf(calls.claude[1]!)).toContain("£2.4bn");
    const [{ payload, usage }] = calls.result as [Calls["result"][number]];
    expect(payload.summary).toBe("Filled.");
    expect((payload.findings as unknown[]).length).toBe(2);
    expect(usage).toMatchObject({ calls: 2, inputTokens: 8000, outputTokens: 1600 });
  });

  it("reuses cached searches and pages when the same question is asked again", async () => {
    const reply = claude({ summary: "s", findings: [SIZE, GROWTH], follow_up_queries: [] });
    const calls = harness([reply]);
    await run("How big is the UK compliance outsourcing market? (case 5)");
    const searches = calls.tavily.length;
    const pages = calls.pages.length;
    await run("How big is the UK compliance outsourcing market? (case 5)");
    expect(calls.tavily.length).toBe(searches);
    expect(calls.pages.length).toBe(pages);
    expect(calls.result).toHaveLength(2);
  });

  it("fails cleanly when no sources can be read, without calling Claude", async () => {
    const calls = harness([claude({})], () => ["/missing1", "/missing2"]);
    await run("How big is the UK legal outsourcing market? (case 6)", "seg2"); // a segment no other case searched, so nothing is cached
    expect(calls.claude).toHaveLength(0);
    expect(calls.fail[0]!.error).toMatch(/no readable sources/i);
  });
});

// Review fix: one failed search must not sink the job; if every search fails, the real error is reported.
describe("marketResearch search failures", () => {
  it("skips a failed query and carries on", async () => {
    const calls = harness([claude({ summary: "s", findings: [SIZE, GROWTH], follow_up_queries: [] })]);
    let n = 0;
    server.use(
      http.post("https://api.tavily.com/search", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        calls.tavily.push(body);
        return n++ === 0 ? HttpResponse.json({ detail: "quota" }, { status: 429 }) : HttpResponse.json({
          results: ["/a", "/b"].map((p, i) => ({ title: p, url: `${SITE}${p}`, content: "s", score: 0.9 - i * 0.1 })),
        });
      }),
    );
    await run("How big is the UK compliance outsourcing market and how fast is it growing? (case 7)");
    expect(calls.fail).toEqual([]);
    expect(calls.result).toHaveLength(1);
  });

  it("reports the search error when every query fails", async () => {
    const calls = harness([claude({})]);
    server.use(http.post("https://api.tavily.com/search", () => HttpResponse.json({ detail: "quota" }, { status: 429 })));
    await run("Which sponsors are active in UK legal outsourcing buyouts? (case 8)", "seg2");
    expect(calls.claude).toHaveLength(0);
    expect(calls.fail[0]!.error).toMatch(/rate limit/i);
  });
});

// Browser review (6.13): three verified findings that don't answer the question must still trigger the one gap-fill.
describe("marketResearch gap-fill when the question is unanswered", () => {
  it("does the gap-fill when Claude says the question is not answered, even with 2+ verified findings", async () => {
    const unanswered = claude({ summary: "Not found.", answered: false, findings: [SIZE, GROWTH], follow_up_queries: ["UK bank compliance outsourcing spend 2025"] });
    const filled = claude({ summary: "Answered.", answered: true, findings: [SIZE, GROWTH], follow_up_queries: [] });
    const calls = harness([unanswered, filled], (q) => (q.includes("bank compliance") ? ["/c"] : ["/a", "/b"]));
    await run("How big is the UK compliance outsourcing market? (case 9)");
    expect(calls.claude).toHaveLength(2);
    expect(calls.result[0]!.payload.summary).toBe("Answered.");
  });

  it("asks Claude to say whether the sources answer the question", async () => {
    const calls = harness([claude({ summary: "s", findings: [SIZE, GROWTH], follow_up_queries: [] })]);
    await run("How big is the UK compliance outsourcing market? (case 10)");
    const format = JSON.stringify((calls.claude[0]!.output_config as { format: unknown }).format);
    expect(format).toContain("answered");
  });
});
