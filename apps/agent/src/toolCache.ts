/** Stable JSON: object keys sorted recursively, so argument order never changes the key. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export interface ToolCache {
  wrap<A, R>(name: string, fn: (args: A) => Promise<R>): (args: A) => Promise<R>;
  stats(): { hits: number; misses: number };
}

/** Memoises tool calls by name and arguments for ttlMs; failures are never cached and ttlMs 0 disables it. */
export function createToolCache({ ttlMs, now = Date.now }: { ttlMs: number; now?: () => number }): ToolCache {
  const entries = new Map<string, { expires: number; value: unknown }>();
  const stats = { hits: 0, misses: 0 };
  return {
    wrap(name, fn) {
      if (ttlMs <= 0) return fn;
      return async (args) => {
        const key = `${name}:${stableJson(args)}`;
        const hit = entries.get(key);
        if (hit && hit.expires > now()) {
          stats.hits++;
          return hit.value as Awaited<ReturnType<typeof fn>>;
        }
        stats.misses++;
        const value = await fn(args);
        entries.set(key, { expires: now() + ttlMs, value });
        return value;
      };
    },
    stats: () => ({ ...stats }),
  };
}
