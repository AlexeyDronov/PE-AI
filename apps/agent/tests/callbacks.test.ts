/** 7.1: the agent reports progress, results and failures back to the API (it never touches the DB). */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ApiCallbacks } from "@/callbacks";
import { API, testConfig } from "./helpers";
import { server } from "./setup";

function capture(path: string, status = 204) {
  const calls: { auth: string | null; body: unknown }[] = [];
  server.use(
    http.post(`${API}${path}`, async ({ request }) => {
      calls.push({ auth: request.headers.get("authorization"), body: await request.json() });
      return new HttpResponse(null, { status });
    }),
  );
  return calls;
}

describe("ApiCallbacks", () => {
  const cb = () => new ApiCallbacks(testConfig());

  it("posts progress with the service token", async () => {
    const calls = capture("/internal/jobs/j1/progress");
    await cb().progress("j1", "search", "Running 6 queries");
    expect(calls).toEqual([{ auth: "Bearer svc-token", body: { step: "search", message: "Running 6 queries" } }]);
  });

  it("posts results and failures", async () => {
    const r = capture("/internal/jobs/j1/result");
    const f = capture("/internal/jobs/j2/fail");
    await cb().result("j1", { summary: "x" });
    await cb().fail("j2", "Search quota exceeded");
    expect(r[0]?.body).toEqual({ payload: { summary: "x" } });
    expect(f[0]?.body).toEqual({ error: "Search quota exceeded" });
  });

  it("retries transient server errors, then gives up with the status", async () => {
    let n = 0;
    server.use(http.post(`${API}/internal/jobs/j1/progress`, () => (++n < 3 ? new HttpResponse(null, { status: 503 }) : new HttpResponse(null, { status: 204 }))));
    await cb().progress("j1", "s", "m");
    expect(n).toBe(3);
    server.use(http.post(`${API}/internal/jobs/j9/progress`, () => new HttpResponse(null, { status: 503 })));
    await expect(cb().progress("j9", "s", "m")).rejects.toMatchObject({ status: 503 });
  });

  it("does not retry client errors such as a rejected result", async () => {
    let n = 0;
    server.use(
      http.post(`${API}/internal/jobs/j1/result`, () => {
        n++;
        return HttpResponse.json({ error: { code: "validation_error", message: "uncited finding" } }, { status: 422 });
      }),
    );
    await expect(cb().result("j1", {})).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/uncited finding/) });
    expect(n).toBe(1);
  });
});
