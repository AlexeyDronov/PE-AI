import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { useCommand } from "@/hooks/useCommand";

import { API, server } from "../setup/server";
import { FakeEventSource, Providers } from "../setup/render";

const SCENARIO = { deal_id: "d1", name: "Downside", case: "down" as const, overrides: { entry_multiple: 14 } };

describe("useCommand", () => {
  it("posts input to the command endpoint and returns the result", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/api/commands/save-scenario`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "s1", name: "Downside" }, { status: 201 });
      }),
    );
    const { result } = renderHook(() => useCommand("saveScenario"), { wrapper: Providers });
    expect(result.current.status).toBe("idle");
    let out: unknown;
    await act(async () => {
      out = await result.current.run(SCENARIO);
    });
    expect(body).toEqual(SCENARIO);
    expect(out).toEqual({ id: "s1", name: "Downside" });
    expect(result.current.status).toBe("success");
    expect(result.current.result).toEqual({ id: "s1", name: "Downside" });
  });

  it("reports validation errors and rejects", async () => {
    server.use(
      http.post(`${API}/api/commands/save-scenario`, () =>
        HttpResponse.json(
          { error: { code: "validation_error", message: "Invalid input", details: [{ loc: ["name"] }] } },
          { status: 422 },
        ),
      ),
    );
    const { result } = renderHook(() => useCommand("saveScenario"), { wrapper: Providers });
    await act(async () => {
      await expect(result.current.run({ ...SCENARIO, name: "" })).rejects.toMatchObject({ code: "validation_error" });
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatchObject({ code: "validation_error" });
  });

  it("tracks the job an async command starts, live", async () => {
    const job = { id: "j1", kind: "market_research", status: "queued", progress: [] };
    let current = job;
    server.use(
      http.post(`${API}/api/commands/start-market-research`, () => HttpResponse.json(job, { status: 202 })),
      http.get(`${API}/api/jobs/j1`, () => HttpResponse.json(current)),
    );
    const { result } = renderHook(() => useCommand("startMarketResearch"), { wrapper: Providers });
    await act(async () => {
      await result.current.run({ question: "How big is UK compliance outsourcing?", segment_id: null });
    });
    await waitFor(() => expect(result.current.job?.status).toBe("queued"));

    current = { ...job, status: "running", progress: [{ step: "search", message: "6 queries" }] as never };
    act(() => FakeEventSource.last?.emit("job", { type: "job", id: "j1", status: "running" }));
    await waitFor(() => expect(result.current.job?.status).toBe("running"));
  });

  it("can be reset", async () => {
    server.use(
      http.post(`${API}/api/commands/save-scenario`, () => HttpResponse.json({ id: "s1" }, { status: 201 })),
    );
    const { result } = renderHook(() => useCommand("saveScenario"), { wrapper: Providers });
    await act(async () => {
      await result.current.run(SCENARIO);
    });
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeUndefined();
  });
});
