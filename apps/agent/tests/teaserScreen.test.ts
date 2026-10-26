/** 7.5: teaserScreen workflow. One Claude call; code gates input, checks figures and reports usage. No live network. */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ApiCallbacks } from "@/callbacks";
import { jobRunners } from "@/jobs";
import "@/workflows";
import { API, testConfig } from "./helpers";
import { server } from "./setup";

const MESSAGES = "https://api.anthropic.com/v1/messages";
const SEGMENTS = ["TIC", "Compliance", "Payroll BPO", "IT & cyber", "Data services", "Engineering", "Legal ops"];

const TEASER =
  "Project Birch: a founder-owned UK provider of payroll outsourcing to mid-sized employers, headquartered in Manchester. " +
  "FY26 revenue £48m and EBITDA £9.6m, growing 14% a year with 82% recurring revenue and 94% gross retention. " +
  "The largest client is 7% of revenue. The founder leads sales. Adviser-run process, teasers circulated in October.";

const EXTRACTED = {
  company: {
    name: "Birchfield Payroll",
    description: "Payroll outsourcing for UK mid-sized employers.",
    hq: "Manchester",
    ownership: "Founder-owned",
    moat: "Multi-year contracts and embedded HR integrations",
  },
  segment: "Payroll BPO",
  code_name: "Project Birch",
  process: "Teaser circulated by adviser",
  ask_multiple: null,
  financials: {
    revenue: 48,
    ebitda: 9.6,
    growth: 0.14,
    recurring_pct: 0.82,
    capex_pct: 0.03,
    da_pct: 0.04,
    nwc_pct: 0.05,
    top_customer_pct: 0.07,
    gross_retention: 0.94,
    cyclicality: "Low",
    ai_resilience: 55,
    fragmentation: 70,
    key_person_risk: true,
  },
  risk_flags: [{ severity: "m", text: "Founder leads sales", mitigant: "Hire a CRO pre-close" }],
  diligence_questions: ["What share of revenue is on multi-year contracts?"],
};

const USAGE = { input_tokens: 900, cache_creation_input_tokens: 0, cache_read_input_tokens: 1600, output_tokens: 700 };

function claudeReply(data: unknown, over: Record<string, unknown> = {}) {
  return {
    id: "msg_t",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text: JSON.stringify(data) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: USAGE,
    ...over,
  };
}

function harness(reply: Record<string, unknown> = claudeReply(EXTRACTED)) {
  const calls = { claude: [] as Record<string, unknown>[], progress: [] as unknown[], result: [] as unknown[], fail: [] as unknown[] };
  server.use(
    http.get(`${API}/api/segments`, () =>
      HttpResponse.json({ items: SEGMENTS.map((short, i) => ({ id: `seg${i}`, short, name: short, median_multiple: 12 })), total: 7 }),
    ),
    http.post(MESSAGES, async ({ request }) => {
      calls.claude.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(reply);
    }),
    http.post(`${API}/internal/jobs/:id/:action`, async ({ params, request }) => {
      const body = await request.json();
      (calls[params.action as "progress" | "result" | "fail"] ?? []).push(body);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

async function run(text: string) {
  const config = testConfig();
  const runner = jobRunners.teaser_screen;
  expect(runner).toBeTypeOf("function");
  await runner!("job1", { text }, { config, callbacks: new ApiCallbacks(config) });
}

const systemText = (body: Record<string, unknown>) => (body.system as { text: string }[]).map((b) => b.text).join("");

describe("teaserScreen workflow", () => {
  it("extracts the teaser with one Claude call and posts the result with usage", async () => {
    const calls = harness();
    await run(TEASER);
    expect(calls.claude).toHaveLength(1);
    expect(calls.fail).toEqual([]);
    expect(calls.result).toEqual([
      { payload: EXTRACTED, usage: { calls: 1, inputTokens: 900, cacheWriteTokens: 0, cacheReadTokens: 1600, outputTokens: 700, costUsd: expect.any(Number) } },
    ]);
    expect(calls.progress.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the system prompt frozen and cacheable: teaser and segments go in the user turn", async () => {
    const calls = harness();
    await run(TEASER);
    await run(TEASER.replace("Birch", "Rowan"));
    const [a, b] = calls.claude;
    expect(systemText(a!)).toBe(systemText(b!));
    expect(systemText(a!).length).toBeGreaterThan(2500); // comfortably above Haiku 5.5's 512-token cache minimum
    expect(systemText(a!)).not.toContain("Project Birch");
    expect(JSON.stringify(a!.messages)).toContain("Project Birch");
    expect(JSON.stringify(a!.messages)).toContain("Payroll BPO");
    expect(a!.max_tokens).toBe(2000);
    expect(JSON.stringify((a!.output_config as { format: unknown }).format)).toContain("diligence_questions");
  });

  it("refuses teasers that are too short or too long without calling Claude", async () => {
    const calls = harness();
    await run("Short note.");
    await run("word ".repeat(7_300)); // ~36.5k characters: over the ~12k token gate
    expect(calls.claude).toHaveLength(0);
    expect(calls.result).toEqual([]);
    expect(calls.fail).toHaveLength(2);
    expect((calls.fail[0] as { error: string }).error).toMatch(/too short/i);
    expect((calls.fail[1] as { error: string }).error).toMatch(/too long/i);
  });

  it("fails the job when extracted figures are inconsistent, reporting the usage spent", async () => {
    const calls = harness(claudeReply({ ...EXTRACTED, financials: { ...EXTRACTED.financials, ebitda: 60 } }));
    await run(TEASER);
    expect(calls.result).toEqual([]);
    expect(calls.fail).toEqual([{ error: expect.stringMatching(/EBITDA/), usage: expect.objectContaining({ calls: 1 }) }]);
  });

  it("fails the job when Claude picks a segment we do not cover", async () => {
    const calls = harness(claudeReply({ ...EXTRACTED, segment: "Space tourism" }));
    await run(TEASER);
    expect(calls.result).toEqual([]);
    expect((calls.fail[0] as { error: string }).error).toMatch(/segment/i);
  });

  it("fails cleanly with usage when Claude declines", async () => {
    const calls = harness(claudeReply({}, { stop_reason: "refusal", content: [] }));
    await run(TEASER);
    expect(calls.fail).toEqual([{ error: expect.stringMatching(/declined/i), usage: expect.objectContaining({ calls: 1 }) }]);
  });
});
