/** 7.4: search and page fetches are cached by their arguments, so a repeated question costs no credits. */
import { describe, expect, it, vi } from "vitest";
import { createToolCache } from "@/toolCache";

describe("createToolCache", () => {
  it("returns the cached result for the same arguments, whatever their key order", async () => {
    const cache = createToolCache({ ttlMs: 1000 });
    const fn = vi.fn(async (args: { query: string; maxResults: number }) => ({ echo: args.query }));
    const search = cache.wrap("webSearch", fn);
    expect(await search({ query: "kyc", maxResults: 5 })).toEqual({ echo: "kyc" });
    expect(await search({ maxResults: 5, query: "kyc" } as { query: string; maxResults: number })).toEqual({ echo: "kyc" });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(cache.stats()).toEqual({ hits: 1, misses: 1 });
  });

  it("keeps tools and arguments apart", async () => {
    const cache = createToolCache({ ttlMs: 1000 });
    const a = vi.fn(async (x: { url: string }) => `a:${x.url}`);
    const b = vi.fn(async (x: { url: string }) => `b:${x.url}`);
    expect(await cache.wrap("fetchPage", a)({ url: "u1" })).toBe("a:u1");
    expect(await cache.wrap("extractTables", b)({ url: "u1" })).toBe("b:u1");
    expect(await cache.wrap("fetchPage", a)({ url: "u2" })).toBe("a:u2");
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("expires entries after the TTL", async () => {
    let now = 0;
    const cache = createToolCache({ ttlMs: 1000, now: () => now });
    const fn = vi.fn(async () => "fresh");
    const cached = cache.wrap("webSearch", fn);
    await cached({ q: 1 });
    now = 999;
    await cached({ q: 1 });
    now = 1001;
    await cached({ q: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never caches failures", async () => {
    const cache = createToolCache({ ttlMs: 1000 });
    const fn = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValueOnce("ok");
    const cached = cache.wrap("webSearch", fn as (x: { q: string }) => Promise<string>);
    await expect(cached({ q: "x" })).rejects.toThrow("quota");
    expect(await cached({ q: "x" })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("is a pass-through when the TTL is zero", async () => {
    const cache = createToolCache({ ttlMs: 0 });
    const fn = vi.fn(async () => 1);
    const cached = cache.wrap("webSearch", fn);
    await cached({ q: 1 });
    await cached({ q: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
