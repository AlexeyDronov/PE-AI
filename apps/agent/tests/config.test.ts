/** 7.1: configuration and model selection. */
import { describe, expect, it } from "vitest";
import { loadConfig } from "@/config";
import { modelFor } from "@/llm";

const base = { API_URL: "http://api.test", AGENT_SERVICE_TOKEN: "t" };

describe("loadConfig", () => {
  it("reads the names used in .env.example, with defaults", () => {
    const c = loadConfig(base);
    expect(c.apiUrl).toBe("http://api.test");
    expect(c.serviceToken).toBe("t");
    expect(c.port).toBe(4111);
    expect(c.models).toEqual({
      research: "anthropic/claude-sonnet-5.5",
      extract: "anthropic/claude-sonnet-5.5",
      draft: "anthropic/claude-sonnet-5.5",
    });
    expect(c.budgets).toEqual({ maxToolCalls: 40, maxSeconds: 300, maxOutputTokens: 8000 });
    expect(c.secUserAgent).toMatch(/Harrowgate/);
  });

  it("lets env override models and budgets", () => {
    const c = loadConfig({ ...base, MODEL_RESEARCH: "openai/gpt-5", MAX_TOOL_CALLS: "12", PORT: "4200" });
    expect(c.models.research).toBe("openai/gpt-5");
    expect(c.budgets.maxToolCalls).toBe(12);
    expect(c.port).toBe(4200);
  });

  it("fails fast, naming the variable, when the service token is missing", () => {
    expect(() => loadConfig({ API_URL: "http://api.test" })).toThrow(/AGENT_SERVICE_TOKEN/);
  });

  it("treats provider keys as optional at startup", () => {
    const c = loadConfig(base);
    expect(c.keys.openrouter).toBeUndefined();
    expect(c.keys.tavily).toBeUndefined();
  });
});

describe("modelFor", () => {
  it("returns the OpenRouter model configured for the role", () => {
    const c = loadConfig({ ...base, OPENROUTER_API_KEY: "k", MODEL_EXTRACT: "openai/gpt-5-mini" });
    expect(modelFor("extract", c).modelId).toBe("openai/gpt-5-mini");
  });

  it("explains which key is missing only when a model is actually needed", () => {
    const c = loadConfig(base);
    expect(() => modelFor("research", c)).toThrow(/OPENROUTER_API_KEY/);
  });
});
