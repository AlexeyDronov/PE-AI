/** 7.1: POST /jobs/{kind}/start — called by the API's AgentClient (arch §5.3). */
import { describe, expect, it, vi } from "vitest";
import { handleStartJob } from "@/jobs";
import { apiRoutes } from "@/mastra/routes";
import { testConfig } from "./helpers";

const flush = () => new Promise((r) => setTimeout(r, 0));

function deps(runner = vi.fn(async () => {})) {
  const callbacks = { progress: vi.fn(async () => {}), result: vi.fn(async () => {}), fail: vi.fn(async () => {}) };
  return { config: testConfig(), callbacks, runners: { market_research: runner }, runner };
}

describe("handleStartJob", () => {
  it("requires the service token", async () => {
    const d = deps();
    for (const authorization of [undefined, "Bearer nope", "svc-token"]) {
      const r = await handleStartJob({ kind: "market_research", authorization, body: { jobId: "j1", input: {} } }, d);
      expect(r.status).toBe(401);
      expect(r.body).toMatchObject({ error: { code: "unauthorized" } });
    }
    expect(d.runner).not.toHaveBeenCalled();
  });

  it("rejects unknown kinds and malformed bodies", async () => {
    const d = deps();
    const auth = "Bearer svc-token";
    expect((await handleStartJob({ kind: "nope", authorization: auth, body: { jobId: "j1", input: {} } }, d)).status).toBe(404);
    expect((await handleStartJob({ kind: "market_research", authorization: auth, body: { input: {} } }, d)).status).toBe(422);
  });

  it("accepts immediately and runs the job in the background", async () => {
    let release!: () => void;
    const runner = vi.fn(() => new Promise<void>((r) => (release = r)));
    const d = deps(runner);
    const r = await handleStartJob({ kind: "market_research", authorization: "Bearer svc-token", body: { jobId: "j1", input: { question: "q" } } }, d);
    expect(r).toEqual({ status: 202, body: { accepted: true, jobId: "j1" } });
    expect(runner).toHaveBeenCalledWith("j1", { question: "q" }, expect.objectContaining({ callbacks: d.callbacks }));
    release();
  });

  it("reports a crashed runner as a failed job instead of crashing the server", async () => {
    const d = deps(vi.fn(async () => {
      throw new Error("model overloaded");
    }));
    await handleStartJob({ kind: "market_research", authorization: "Bearer svc-token", body: { jobId: "j1", input: {} } }, d);
    await flush();
    expect(d.callbacks.fail).toHaveBeenCalledWith("j1", "model overloaded");
  });
});

describe("Mastra server routes", () => {
  it("registers the job-start route as a POST", () => {
    const route = apiRoutes.find((r) => r.path === "/jobs/:kind/start");
    expect(route?.method).toBe("POST");
  });
});
