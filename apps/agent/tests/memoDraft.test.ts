/** 7.7: memoDraft workflow. One Claude call writes every requested section from the API's compact context. No live network. */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ApiCallbacks } from "@/callbacks";
import { jobRunners } from "@/jobs";
import "@/workflows";
import { API, testConfig } from "./helpers";
import { server } from "./setup";

const MESSAGES = "https://api.anthropic.com/v1/messages";

const CONTEXT = {
  deal: { code_name: "Project Linden", company: "Northvale Compliance", segment: "Compliance & regulatory services", stage: "CIM" },
  financials: { revenue: 61, ebitda: 14.6, growth: 0.22 },
  screening: { score: 78, verdict: "Advance", gate_reason: null },
  flags: [{ severity: "m", text: "Entry multiple above segment median", mitigant: "Earn-out" }],
  questions: ["How much recurring revenue is multi-year contracted?"],
  debt_capacity: { max_leverage: 5.2, max_debt: 75.9, interest_cover: 3.1 },
  lbo: { case: "base", scenario: null, returns: { irr: 0.231, moic: 2.8 }, hurdle: 0.2, assumptions: { entry_multiple: 15.5 } },
  sensitivity: { irr_min: 0.12, irr_max: 0.31 },
};

const SECTIONS = ["summary", "risks", "recommendation"];

function claude(sections: { key: string; markdown: string }[], over: Record<string, unknown> = {}) {
  return {
    id: "msg_m",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text: JSON.stringify({ sections }) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 3000, cache_creation_input_tokens: 1800, cache_read_input_tokens: 0, output_tokens: 3500 },
    ...over,
  };
}

const drafted = (keys: string[]) => keys.map((key) => ({ key, markdown: `## ${key}\n\nProject Linden returns 23.1% IRR.` }));

function harness(reply: Record<string, unknown>) {
  const calls = { claude: [] as Record<string, unknown>[], result: [] as unknown[], fail: [] as { error: string }[] };
  server.use(
    http.post(MESSAGES, async ({ request }) => {
      calls.claude.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(reply);
    }),
    http.post(`${API}/internal/jobs/:id/:action`, async ({ params, request }) => {
      const body = await request.json();
      if (params.action === "result") calls.result.push(body);
      if (params.action === "fail") calls.fail.push(body as { error: string });
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

async function run(sections = SECTIONS, context: unknown = CONTEXT) {
  const config = testConfig();
  expect(jobRunners.memo_draft).toBeTypeOf("function");
  await jobRunners.memo_draft!("job-m", { deal_id: "d1", scenario_id: null, sections, context }, { config, callbacks: new ApiCallbacks(config) });
}

describe("memoDraft workflow", () => {
  it("drafts all requested sections in one call and posts them in the requested order with usage", async () => {
    const calls = harness(claude(drafted(["recommendation", "summary", "risks"])));
    await run();
    expect(calls.claude).toHaveLength(1);
    expect(calls.fail).toEqual([]);
    expect(calls.result).toEqual([
      { payload: { sections: drafted(SECTIONS) }, usage: expect.objectContaining({ calls: 1, cacheWriteTokens: 1800, outputTokens: 3500 }) },
    ]);
  });

  it("sends the compact context and section list in the user turn, under a frozen system prompt", async () => {
    const calls = harness(claude(drafted(SECTIONS)));
    await run();
    await run(["summary"], { ...CONTEXT, deal: { ...CONTEXT.deal, code_name: "Project Oak" } });
    const [a, b] = calls.claude as [Record<string, unknown>, Record<string, unknown>];
    const system = (body: Record<string, unknown>) => (body.system as { text: string }[]).map((x) => x.text).join("");
    expect(system(a)).toBe(system(b));
    expect(system(a).length).toBeGreaterThan(2500);
    expect(system(a)).not.toContain("Project Linden");
    const user = JSON.stringify(a.messages);
    expect(user).toContain("Project Linden");
    expect(user).toContain("0.231");
    for (const key of SECTIONS) expect(user).toContain(key);
    // Live run: 7 sections at the old 6,000 cap were cut off (thinking tokens count too), so the cap is 10,000 and the prompt sets a word budget.
    expect(a.max_tokens).toBe(10_000);
    expect(system(a)).toMatch(/120.{1,6}250 words/);
  });

  it("fails the job, with usage, when Claude omits or invents sections", async () => {
    for (const keys of [["summary", "risks"], [...SECTIONS, "market"]]) {
      const calls = harness(claude(drafted(keys)));
      await run();
      expect(calls.result).toEqual([]);
      expect(calls.fail[0]!.error).toMatch(/section/i);
    }
  });

  it("fails cleanly when the memo is cut off at max_tokens", async () => {
    const calls = harness(claude(drafted(SECTIONS), { stop_reason: "max_tokens" }));
    await run();
    expect(calls.fail).toEqual([{ error: expect.stringMatching(/cut off|truncated|too long/i), usage: expect.objectContaining({ calls: 1 }) }]);
  });

  it("rejects a job without context before calling Claude", async () => {
    const calls = harness(claude(drafted(SECTIONS)));
    await run(SECTIONS, null);
    expect(calls.claude).toHaveLength(0);
    expect(calls.fail).toHaveLength(1);
  });
});
