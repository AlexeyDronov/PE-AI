import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Config } from "./config";
import { AgentError, MissingKeyError } from "./errors";

// Haiku 5.5 list prices, USD per million tokens.
const INPUT_PER_M = 0.1;
const OUTPUT_PER_M = 0.5;
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

export interface Usage {
  calls: number;
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  costUsd: number;
}

export type TokenCounts = Pick<Usage, "inputTokens" | "cacheWriteTokens" | "cacheReadTokens" | "outputTokens">;

export function estimateCostUsd(t: TokenCounts): number {
  const input = t.inputTokens + t.cacheWriteTokens * CACHE_WRITE_MULTIPLIER + t.cacheReadTokens * CACHE_READ_MULTIPLIER;
  return (input * INPUT_PER_M + t.outputTokens * OUTPUT_PER_M) / 1_000_000;
}

/** Total usage across the calls of one job. */
export function sumUsage(...usages: Usage[]): Usage {
  return usages.reduce(
    (a, u) => ({
      calls: a.calls + u.calls,
      inputTokens: a.inputTokens + u.inputTokens,
      cacheWriteTokens: a.cacheWriteTokens + u.cacheWriteTokens,
      cacheReadTokens: a.cacheReadTokens + u.cacheReadTokens,
      outputTokens: a.outputTokens + u.outputTokens,
      costUsd: a.costUsd + u.costUsd,
    }),
    { calls: 0, inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0, costUsd: 0 },
  );
}

/** A Claude call that finished but cannot be used; carries the usage it spent. */
export class LlmError extends AgentError {
  constructor(
    code: "refusal" | "truncated" | "invalid_output",
    message: string,
    readonly usage: Usage,
  ) {
    super(code, message);
  }
}

/** The Mastra model-router id for the Studio-only agents. */
export function studioModel(config: Config): string {
  return `anthropic/${config.model}`;
}

function toUsage(raw: Anthropic.Usage): Usage {
  const counts = {
    inputTokens: raw.input_tokens ?? 0,
    cacheWriteTokens: raw.cache_creation_input_tokens ?? 0,
    cacheReadTokens: raw.cache_read_input_tokens ?? 0,
    outputTokens: raw.output_tokens ?? 0,
  };
  return { calls: 1, ...counts, costUsd: estimateCostUsd(counts) };
}

export interface ClaudeRequest<T> {
  config: Config;
  /** Frozen prefix: cached, so nothing volatile belongs here. */
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens: number;
}

/** The one model call every workflow uses: cached system prompt, schema-constrained output, usage reported. */
export async function callClaude<T>({ config, system, prompt, schema, maxTokens }: ClaudeRequest<T>): Promise<{ data: T; usage: Usage }> {
  if (!config.keys.anthropic) throw new MissingKeyError("ANTHROPIC_API_KEY");
  const client = new Anthropic({ apiKey: config.keys.anthropic });
  // The SDK helper moves constraints structured outputs can't enforce (ranges, lengths) into descriptions; zod still checks them below.
  const { type, schema: jsonSchema } = zodOutputFormat(schema);
  const response = await client.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
    output_config: { effort: config.effort, format: { type, schema: jsonSchema } },
  });
  const usage = toUsage(response.usage);
  if (response.stop_reason === "refusal") throw new LlmError("refusal", "Claude declined this request.", usage);
  if (response.stop_reason === "max_tokens") throw new LlmError("truncated", "Claude's answer was cut off before it finished.", usage);
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new LlmError("invalid_output", "Claude's answer was not valid JSON.", usage);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new LlmError("invalid_output", `Claude's answer did not match the expected shape: ${parsed.error.message}`, usage);
  return { data: parsed.data, usage };
}
