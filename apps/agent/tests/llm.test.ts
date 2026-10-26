/** 7.4: the one Claude call every workflow uses (docs/05-agent-cost-design.md). No live network: the API is mocked. */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MissingKeyError } from "@/errors";
import { LlmError, callClaude, estimateCostUsd, sumUsage } from "@/llm";
import { testConfig } from "./helpers";
import { server } from "./setup";

const MESSAGES = "https://api.anthropic.com/v1/messages";
const schema = z.object({ answer: z.string(), score: z.number() });
const SYSTEM = "You are a test analyst. Reply in the given JSON shape.";

function reply(over: Record<string, unknown> = {}, text = '{"answer":"yes","score":3}') {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "text", text },
    ],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 1500, output_tokens: 300 },
    ...over,
  };
}

function mockClaude(body: Record<string, unknown>) {
  const requests: { headers: Headers; body: Record<string, unknown> }[] = [];
  server.use(
    http.post(MESSAGES, async ({ request }) => {
      requests.push({ headers: request.headers, body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json(body);
    }),
  );
  return requests;
}

const call = (config = testConfig()) =>
  callClaude({ config, system: SYSTEM, prompt: "Teaser text here", schema, maxTokens: 2000 });

describe("callClaude", () => {
  it("returns schema-validated data and the call's usage", async () => {
    mockClaude(reply());
    const { data, usage } = await call();
    expect(data).toEqual({ answer: "yes", score: 3 });
    expect(usage).toMatchObject({ calls: 1, inputTokens: 200, cacheReadTokens: 1500, cacheWriteTokens: 0, outputTokens: 300 });
    expect(usage.costUsd).toBeCloseTo(0.000185, 9);
  });

  it("sends the cost-design request shape: cached frozen system prompt, medium effort, JSON schema, max_tokens", async () => {
    const requests = mockClaude(reply());
    await call();
    expect(requests).toHaveLength(1);
    const { headers, body } = requests[0]!;
    expect(headers.get("x-api-key")).toBe("sk-test");
    expect(body.model).toBe("claude-haiku-5-5");
    expect(body.max_tokens).toBe(2000);
    const system = body.system as { type: string; text: string; cache_control?: unknown }[];
    expect(Array.isArray(system)).toBe(true);
    expect(system.map((b) => b.text).join("")).toBe(SYSTEM);
    expect(system.at(-1)?.cache_control).toEqual({ type: "ephemeral" });
    const outputConfig = body.output_config as { effort: string; format: { type: string; schema: unknown } };
    expect(outputConfig.effort).toBe("medium");
    expect(outputConfig.format.type).toBe("json_schema");
    expect(JSON.stringify(outputConfig.format.schema)).toContain("score");
    expect(JSON.stringify(body.messages)).toContain("Teaser text here");
    for (const banned of ["temperature", "top_p", "top_k", "tools"]) expect(body).not.toHaveProperty(banned);
  });

  it("uses the configured model and effort", async () => {
    const requests = mockClaude(reply());
    await call(testConfig({ MODEL: "claude-sonnet-5-5", EFFORT: "low" }));
    expect(requests[0]!.body.model).toBe("claude-sonnet-5-5");
    expect((requests[0]!.body.output_config as { effort: string }).effort).toBe("low");
  });

  it("fails cleanly on a refusal, keeping the usage that was spent", async () => {
    mockClaude(reply({ stop_reason: "refusal", content: [] }));
    const err = await call().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err).toMatchObject({ code: "refusal", usage: { calls: 1, outputTokens: 300 } });
    expect((err as Error).message).toMatch(/declined/i);
  });

  it("fails cleanly when the output hit max_tokens", async () => {
    mockClaude(reply({ stop_reason: "max_tokens" }, '{"answer":"ye'));
    await expect(call()).rejects.toMatchObject({ code: "truncated" });
  });

  it("rejects output that does not match the schema", async () => {
    mockClaude(reply({}, '{"answer":"yes"}'));
    await expect(call()).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("names the missing key only when a call is actually made", async () => {
    await expect(call(testConfig({ ANTHROPIC_API_KEY: undefined }))).rejects.toBeInstanceOf(MissingKeyError);
    await expect(call(testConfig({ ANTHROPIC_API_KEY: undefined }))).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("usage accounting", () => {
  it("prices Haiku 5.5 tokens: input $0.10/M, cache write 1.25x, cache read 0.1x, output $0.50/M", () => {
    expect(estimateCostUsd({ inputTokens: 1_000_000, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0 })).toBeCloseTo(0.1, 9);
    expect(estimateCostUsd({ inputTokens: 0, cacheWriteTokens: 1_000_000, cacheReadTokens: 0, outputTokens: 0 })).toBeCloseTo(0.125, 9);
    expect(estimateCostUsd({ inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(0.01, 9);
    expect(estimateCostUsd({ inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 1_000_000 })).toBeCloseTo(0.5, 9);
  });

  it("sums the usage of several calls in one job", () => {
    const one = { calls: 1, inputTokens: 10, cacheWriteTokens: 5, cacheReadTokens: 0, outputTokens: 7, costUsd: 0.001 };
    const two = { calls: 1, inputTokens: 1, cacheWriteTokens: 0, cacheReadTokens: 5, outputTokens: 3, costUsd: 0.002 };
    const total = sumUsage(one, two);
    expect(total).toMatchObject({ calls: 2, inputTokens: 11, cacheWriteTokens: 5, cacheReadTokens: 5, outputTokens: 10 });
    expect(total.costUsd).toBeCloseTo(0.003, 9);
  });
});
