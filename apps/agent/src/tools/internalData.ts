import { ToolError } from "../errors";

export const INTERNAL_RESOURCES = [
  "segments",
  "deals",
  "transactions",
  "research-reports",
  "portfolio-companies",
  "market-summary",
  "pipeline-summary",
] as const;

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

/** Read-only GET against our own API, restricted to an allow-list of resources. */
export async function readInternal(
  input: { resource: string; id?: string; params: Record<string, string | number | boolean> },
  apiUrl: string,
): Promise<unknown> {
  if (!(INTERNAL_RESOURCES as readonly string[]).includes(input.resource)) {
    throw new ToolError("not_allowed", `Resource "${input.resource}" is not readable; allowed: ${INTERNAL_RESOURCES.join(", ")}`);
  }
  if (input.id !== undefined && !SAFE_ID.test(input.id)) throw new ToolError("not_allowed", "Invalid resource id");
  const url = new URL(`${apiUrl.replace(/\/$/, "")}/api/${input.resource}${input.id ? `/${input.id}` : ""}`);
  for (const [key, value] of Object.entries(input.params)) url.searchParams.set(key, String(value));
  const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new ToolError("upstream_error", `Internal API returned HTTP ${res.status} for ${input.resource}`);
  return res.json();
}
