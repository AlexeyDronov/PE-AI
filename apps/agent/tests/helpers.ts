import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadConfig } from "@/config";

export const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

export const API = "http://api.test";

export const testConfig = (overrides: Record<string, string | undefined> = {}) =>
  loadConfig({
    API_URL: API,
    AGENT_SERVICE_TOKEN: "svc-token",
    OPENROUTER_API_KEY: "or-key",
    TAVILY_API_KEY: "tv-key",
    COMPANIES_HOUSE_API_KEY: "ch-key",
    ...overrides,
  });
