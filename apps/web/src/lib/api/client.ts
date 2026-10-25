export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Params = Record<string, unknown>;

export function buildPath(template: string, params: Params = {}): { path: string; rest: Params } {
  const rest = { ...params };
  const path = template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = rest[name];
    if (value === undefined || value === null) throw new Error(`Missing path param: ${name}`);
    delete rest[name];
    return encodeURIComponent(String(value));
  });
  return { path, rest };
}

function queryString(params: Params): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) qs.append(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const DEFAULT_TIMEOUT_MS = 15_000;

async function request(
  baseUrl: string,
  path: string,
  method: "GET" | "POST",
  opts: { params?: Params; body?: unknown; timeoutMs?: number },
  read: (res: Response) => Promise<unknown>,
): Promise<unknown> {
  const url = `${baseUrl}/api${path}${method === "GET" && opts.params ? queryString(opts.params) : ""}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw timeoutError();
      throw new ApiError(0, "network", "Network error: the API is unreachable");
    }
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string; details?: unknown };
      } | null;
      throw new ApiError(
        res.status,
        payload?.error?.code ?? "http_error",
        payload?.error?.message ?? res.statusText,
        payload?.error?.details,
      );
    }
    try {
      return await read(res);
    } catch (err) {
      if (controller.signal.aborted) throw timeoutError();
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch<T>(
  baseUrl: string,
  path: string,
  opts: { method?: "GET" | "POST"; params?: Params; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  return (await request(baseUrl, path, opts.method ?? "GET", opts, (res) =>
    res.status === 204 ? Promise.resolve(undefined) : res.json(),
  )) as T;
}

/** POST a JSON body and receive a file; the name comes from Content-Disposition. */
export async function apiDownload(baseUrl: string, path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
  return (await request(baseUrl, path, "POST", { body }, async (res) => {
    const match = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "");
    return { blob: await res.blob(), filename: match?.[1] ?? "download" };
  })) as { blob: Blob; filename: string };
}

function timeoutError(): ApiError {
  return new ApiError(0, "timeout", "The server took too long to respond.");
}
