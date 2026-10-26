import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseEnv } from "node:util";
import { z } from "zod";

const optionalKey = z.string().min(1).optional();

const envSchema = z.object({
  API_URL: z.string().min(1, "API_URL is required"),
  AGENT_SERVICE_TOKEN: z.string().min(1, "AGENT_SERVICE_TOKEN is required"),
  PORT: z.coerce.number().int().positive().default(4111),
  MODEL: z.string().min(1).default("claude-haiku-5-5"),
  EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
  MAX_SECONDS: z.coerce.number().positive().default(300),
  TOOL_CACHE_HOURS: z.coerce.number().min(0).default(24),
  ANTHROPIC_API_KEY: optionalKey,
  TAVILY_API_KEY: optionalKey,
  COMPANIES_HOUSE_API_KEY: optionalKey,
  SEC_USER_AGENT: z.string().min(1).default("Harrowgate Deal Copilot research@harrowgate.example"),
});

export type Effort = z.infer<typeof envSchema>["EFFORT"];

export interface Config {
  apiUrl: string;
  serviceToken: string;
  port: number;
  model: string;
  effort: Effort;
  budgets: { maxSeconds: number };
  toolCacheHours: number;
  keys: { anthropic?: string; tavily?: string; companiesHouse?: string };
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
    model: e.MODEL,
    effort: e.EFFORT,
    budgets: { maxSeconds: e.MAX_SECONDS },
    toolCacheHours: e.TOOL_CACHE_HOURS,
    keys: { anthropic: e.ANTHROPIC_API_KEY, tavily: e.TAVILY_API_KEY, companiesHouse: e.COMPANIES_HOUSE_API_KEY },
    secUserAgent: e.SEC_USER_AGENT,
  };
}

/** Fill variables from the .env files that exist, never overriding ones already set. */
export function loadEnvFiles(paths: string[], env: Record<string, string | undefined> = process.env): void {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(path, "utf8")))) {
      if (env[key] === undefined) env[key] = value;
    }
  }
}

/** `.env` paths from `start` up to the workspace root (the folder with pnpm-workspace.yaml), nearest first. */
export function envFilesUpward(start: string = process.cwd()): string[] {
  const paths: string[] = [];
  for (let dir = start; ; dir = dirname(dir)) {
    paths.push(join(dir, ".env"));
    if (existsSync(join(dir, "pnpm-workspace.yaml")) || dirname(dir) === dir) return paths;
  }
}
