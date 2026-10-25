import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { useResource } from "@/hooks/useResource";
import { API, server } from "../setup/server";
import { Providers } from "../setup/render";

function countRequests(method: "get" | "post", path: string, reply: (url: URL, body: unknown) => unknown) {
  const calls: { url: URL; body: unknown }[] = [];
  server.use(
    http[method](`${API}/api${path}`, async ({ request }) => {
      const url = new URL(request.url);
      const body = method === "post" ? await request.json() : undefined;
      calls.push({ url, body });
      return HttpResponse.json(reply(url, body) as never);
    }),
  );
  return calls;
}

describe("useResource", () => {
  it("loads a list resource", async () => {
    countRequests("get", "/segments", () => ({ items: [{ id: "s1", name: "TIC" }], total: 1 }));
    const { result } = renderHook(() => useResource("segments"), { wrapper: Providers });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.data?.total).toBe(1));
  });

  it("puts path params in the path and the rest in the query", async () => {
    const calls = countRequests("get", "/deals/:id", (url) => ({ id: url.pathname.split("/").pop() }));
    const { result } = renderHook(() => useResource("deal", { id: "d1" }), { wrapper: Providers });
    await waitFor(() => expect(result.current.data).toEqual({ id: "d1" }));
    expect(calls[0]?.url.pathname).toBe("/api/deals/d1");
    expect(calls[0]?.url.search).toBe("");

    const list = countRequests("get", "/deals", () => ({ items: [], total: 0 }));
    renderHook(() => useResource("deals", { stage: "CIM" }), { wrapper: Providers });
    await waitFor(() => expect(list).toHaveLength(1));
    expect(list[0]?.url.search).toBe("?stage=CIM");
  });

  it("POSTs params as the body for compute resources", async () => {
    const calls = countRequests("post", "/compute/lbo", () => ({ irr: 0.203 }));
    const { result } = renderHook(() => useResource("lbo", { deal_id: "d1", overrides: { entry_multiple: 15.5 } }), {
      wrapper: Providers,
    });
    await waitFor(() => expect(result.current.data).toEqual({ irr: 0.203 }));
    expect(calls[0]?.body).toEqual({ deal_id: "d1", overrides: { entry_multiple: 15.5 } });
  });

  it("shares one request between components asking for the same thing, regardless of key order", async () => {
    const calls = countRequests("get", "/deals", () => ({ items: [], total: 0 }));
    renderHook(
      () => {
        useResource("deals", { stage: "CIM", sort: "-ask_multiple" });
        useResource("deals", { sort: "-ask_multiple", stage: "CIM" });
      },
      { wrapper: Providers },
    );
    await waitFor(() => expect(calls).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toHaveLength(1);
  });

  it("does nothing while params are null", async () => {
    const calls = countRequests("get", "/deals/:id", () => ({}));
    const { result } = renderHook(() => useResource("deal", null), { wrapper: Providers });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it("debounces rapidly changing params", async () => {
    const calls = countRequests("post", "/compute/lbo", (_u, body) => body);
    const { rerender } = renderHook(({ entry }) => useResource("lbo", { deal_id: "d1", overrides: { entry_multiple: entry } }, { debounceMs: 120 }), {
      wrapper: Providers,
      initialProps: { entry: 15 },
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    rerender({ entry: 15.5 });
    rerender({ entry: 16 });
    rerender({ entry: 16.5 });
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 1000 });
    expect(calls[1]?.body).toEqual({ deal_id: "d1", overrides: { entry_multiple: 16.5 } });
  });

  it("keeps the previous result on screen while new params load", async () => {
    countRequests("post", "/compute/lbo", (_u, body) => body);
    const { result, rerender } = renderHook(
      ({ entry }) => useResource("lbo", { deal_id: "d1", overrides: { entry_multiple: entry } }, { keepPrevious: true }),
      { wrapper: Providers, initialProps: { entry: 15 } },
    );
    await waitFor(() => expect(result.current.data).toEqual({ deal_id: "d1", overrides: { entry_multiple: 15 } }));
    act(() => rerender({ entry: 16 }));
    expect(result.current.data).toEqual({ deal_id: "d1", overrides: { entry_multiple: 15 } });
    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual({ deal_id: "d1", overrides: { entry_multiple: 16 } }));
  });

  it("exposes server errors as ApiError", async () => {
    server.use(
      http.get(`${API}/api/deals/zz`, () =>
        HttpResponse.json({ error: { code: "not_found", message: "missing" } }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useResource("deal", { id: "zz" }), { wrapper: Providers });
    await waitFor(() => expect(result.current.error).toMatchObject({ code: "not_found", status: 404 }));
  });
});
