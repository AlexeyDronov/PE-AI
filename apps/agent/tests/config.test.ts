/** 7.1, amended in 7.4: configuration, the repo-root .env, and the Studio model. */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { envFilesUpward, loadConfig, loadEnvFiles } from "@/config";
import { studioModel } from "@/llm";

const base = { API_URL: "http://api.test", AGENT_SERVICE_TOKEN: "t" };

describe("loadConfig", () => {
  it("defaults to Claude Haiku 5.5 at medium effort, with a 24h tool cache", () => {
    const c = loadConfig(base);
    expect(c.apiUrl).toBe("http://api.test");
    expect(c.serviceToken).toBe("t");
    expect(c.port).toBe(4111);
    expect(c.model).toBe("claude-haiku-5-5");
    expect(c.effort).toBe("medium");
    expect(c.budgets).toEqual({ maxSeconds: 300 });
    expect(c.toolCacheHours).toBe(24);
    expect(c.secUserAgent).toMatch(/Harrowgate/);
  });

  it("lets env override the model, effort, budgets and port", () => {
    const c = loadConfig({ ...base, MODEL: "claude-sonnet-5-5", EFFORT: "low", MAX_SECONDS: "60", PORT: "4200", TOOL_CACHE_HOURS: "0" });
    expect(c.model).toBe("claude-sonnet-5-5");
    expect(c.effort).toBe("low");
    expect(c.budgets.maxSeconds).toBe(60);
    expect(c.port).toBe(4200);
    expect(c.toolCacheHours).toBe(0);
  });

  it("rejects an unknown effort level, naming the variable", () => {
    expect(() => loadConfig({ ...base, EFFORT: "extreme" })).toThrow(/EFFORT/);
  });

  it("fails fast, naming the variable, when the service token is missing", () => {
    expect(() => loadConfig({ API_URL: "http://api.test" })).toThrow(/AGENT_SERVICE_TOKEN/);
  });

  it("treats provider keys as optional at startup and reads ANTHROPIC_API_KEY", () => {
    expect(loadConfig(base).keys.anthropic).toBeUndefined();
    expect(loadConfig(base).keys.tavily).toBeUndefined();
    expect(loadConfig({ ...base, ANTHROPIC_API_KEY: "sk-test" }).keys.anthropic).toBe("sk-test");
  });

  it("no longer reads OpenRouter settings", () => {
    const c = loadConfig({ ...base, OPENROUTER_API_KEY: "or-secret" });
    expect(JSON.stringify(c)).not.toContain("or-secret");
  });
});

describe("loadEnvFiles", () => {
  const envFile = (body: string) => {
    const dir = mkdtempSync(join(tmpdir(), "hg-env-"));
    const path = join(dir, ".env");
    writeFileSync(path, body);
    return path;
  };

  it("fills variables from the first existing file without overriding ones already set", () => {
    const path = envFile("ANTHROPIC_API_KEY=from-file\nTAVILY_API_KEY=tv\n");
    const env: Record<string, string | undefined> = { TAVILY_API_KEY: "already" };
    loadEnvFiles([join(tmpdir(), "missing", ".env"), path], env);
    expect(env.ANTHROPIC_API_KEY).toBe("from-file");
    expect(env.TAVILY_API_KEY).toBe("already");
  });

  it("does nothing when no file exists", () => {
    const env: Record<string, string | undefined> = {};
    expect(() => loadEnvFiles([join(tmpdir(), "nope", ".env")], env)).not.toThrow();
    expect(env).toEqual({});
  });
});

describe("envFilesUpward", () => {
  // Found in the live run: mastra dev runs from apps/agent/.mastra/output, so a fixed ../../.env missed the repo root.
  it("lists .env candidates from the start folder up to the workspace root, nearest first", () => {
    const root = mkdtempSync(join(tmpdir(), "hg-ws-"));
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
    const deep = join(root, "apps", "agent", ".mastra", "output");
    expect(envFilesUpward(deep)).toEqual([
      join(deep, ".env"),
      join(root, "apps", "agent", ".mastra", ".env"),
      join(root, "apps", "agent", ".env"),
      join(root, "apps", ".env"),
      join(root, ".env"),
    ]);
  });
});

describe("studioModel", () => {
  it("names the Anthropic model for Mastra's model router (Studio-only agents)", () => {
    expect(studioModel(loadConfig(base))).toBe("anthropic/claude-haiku-5-5");
  });
});
