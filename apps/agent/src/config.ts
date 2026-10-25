import { z } from "zod";

const model = z.string().min(1).default("anthropic/claude-sonnet-5.5");
const optionalKey = z.string().min(1).optional();

const envSchema = z.object({
  API_URL: z.string().min(1, "API_URL is required"),
  AGENT_SERVICE_TOKEN: z.string().min(1, "AGENT_SERVICE_TOKEN is required"),
  PORT: z.coerce.number().int().positive().default(4111),
  MODEL_RESEARCH: model,
  MODEL_EXTRACT: model,
  MODEL_DRAFT: model,
  MAX_TOOL_CALLS: z.coerce.number().int().positive().default(40),
  MAX_SECONDS: z.coerce.number().positive().default(300),
  MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(8000),
  OPENROUTER_API_KEY: optionalKey,
  TAVILY_API_KEY: optionalKey,
  COMPANIES_HOUSE_API_KEY: optionalKey,
  SEC_USER_AGENT: z.string().min(1).default("Harrowgate Deal Copilot research@harrowgate.example"),
});

export type ModelRole = "research" | "extract" | "draft";

export interface Config {
  apiUrl: string;
  serviceToken: string;
  port: number;
  models: Record<ModelRole, string>;
  budgets: { maxToolCalls: number; maxSeconds: number; maxOutputTokens: number };
  keys: { openrouter?: string; tavily?: string; companiesHouse?: string };
  secUserAgent: string;
}

/** Validate the environment into a typed config; throws naming the offending variable. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid agent configuration: ${problems.join("; ")}`);
  }
  const e = parsed.data;
  return {
    apiUrl: e.API_URL.replace(/\/$/, ""),
    serviceToken: e.AGENT_SERVICE_TOKEN,
    port: e.PORT,
    models: { research: e.MODEL_RESEARCH, extract: e.MODEL_EXTRACT, draft: e.MODEL_DRAFT },
    budgets: { maxToolCalls: e.MAX_TOOL_CALLS, maxSeconds: e.MAX_SECONDS, maxOutputTokens: e.MAX_OUTPUT_TOKENS },
    keys: { openrouter: e.OPENROUTER_API_KEY, tavily: e.TAVILY_API_KEY, companiesHouse: e.COMPANIES_HOUSE_API_KEY },
    secUserAgent: e.SEC_USER_AGENT,
  };
}
