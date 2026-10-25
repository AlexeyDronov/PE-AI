import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ApiError, apiFetch, buildPath } from "@/lib/api/client";
import { API, server } from "../setup/server";

describe("buildPath", () => {
  it("fills path params and leaves the rest for the query", () => {
    expect(buildPath("/deals/{id}", { id: "d1", stage: "CIM" })).toEqual({
      path: "/deals/d1",
      rest: { stage: "CIM" },
    });
  });
  it("encodes path params", () => {
    expect(buildPath("/deals/{id}", { id: "a/b" }).path).toBe("/deals/a%2Fb");
  });
  it("throws when a path param is missing", () => {
    expect(() => buildPath("/deals/{id}", {})).toThrow(/id/);
  });
});

describe("apiFetch", () => {
  it("GETs with a query string, skipping null and undefined", async () => {
    let seen = "";
    server.use(
      http.get(`${API}/api/deals`, ({ request }) => {
        seen = new URL(request.url).search;
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    await apiFetch(API, "/deals", { params: { stage: "CIM", sort: "-score", segment_id: null, x: undefined } });
    expect(seen).toBe("?stage=CIM&sort=-score");
  });

  it("POSTs JSON", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/api/commands/create-annotation`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "a1" }, { status: 201 });
      }),
    );
    const out = await apiFetch(API, "/commands/create-annotation", { method: "POST", body: { note: "hi" } });
    expect(body).toEqual({ note: "hi" });
    expect(out).toEqual({ id: "a1" });
  });

  it("returns undefined for 204", async () => {
    server.use(http.post(`${API}/api/x`, () => new HttpResponse(null, { status: 204 })));
    await expect(apiFetch(API, "/x", { method: "POST" })).resolves.toBeUndefined();
  });

  it("raises ApiError carrying the server error shape", async () => {
    server.use(
      http.get(`${API}/api/deals/zz`, () =>
        HttpResponse.json({ error: { code: "not_found", message: "Deal zz not found" } }, { status: 404 }),
      ),
    );
    const err = await apiFetch(API, "/deals/zz").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: "not_found", message: "Deal zz not found" });
  });

  it("raises ApiError with code 'network' when the server is unreachable", async () => {
    server.use(http.get(`${API}/api/down`, () => HttpResponse.error()));
    await expect(apiFetch(API, "/down")).rejects.toMatchObject({ code: "network", status: 0 });
  });
});

describe("apiFetch timeouts (found in browser review: pages hung on skeletons)", () => {
  it("fails with code 'timeout' instead of waiting forever", async () => {
    server.use(http.get(`${API}/api/slow`, async () => {
      await new Promise((r) => setTimeout(r, 500));
      return HttpResponse.json({});
    }));
    await expect(apiFetch(API, "/slow", { timeoutMs: 50 })).rejects.toMatchObject({ code: "timeout", status: 0 });
  });

  it("has a sensible default timeout", async () => {
    const { DEFAULT_TIMEOUT_MS } = await import("@/lib/api/client");
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});
