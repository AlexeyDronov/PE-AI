import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractText, getDocumentProxy } from "unpdf";
import { ToolError } from "../errors";
import { extractTitle, readableText } from "./html";

const USER_AGENT = "HarrowgateDealCopilot/1.0 (research agent)";
const MAX_REDIRECTS = 5;
const MAX_BYTES = 3_000_000;

function isPrivateIPv4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);
  return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
}

const isPrivateAddress = (ip: string) => (isIP(ip) === 4 ? isPrivateIPv4(ip) : isPrivateIPv6(ip));

const blocked = (url: string) => new ToolError("blocked_url", `Refusing to fetch ${url}: only public http(s) pages are allowed`);

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw blocked(url.href);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) throw blocked(url.href);
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw blocked(url.href);
    return;
  }
  try {
    const addresses = await Promise.race([
      lookup(host, { all: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("dns timeout")), 3000).unref()),
    ]);
    if (addresses.some((a) => isPrivateAddress(a.address))) throw blocked(url.href);
  } catch (err) {
    if (err instanceof ToolError) throw err;
  }
}

const robotsCache = new Map<string, string[]>();

async function disallowedPrefixes(origin: string): Promise<string[]> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;
  let prefixes: string[] = [];
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      let applies = false;
      for (const raw of (await res.text()).split(/\r?\n/)) {
        const [field = "", ...rest] = raw.replace(/#.*/, "").split(":");
        const value = rest.join(":").trim();
        const name = field.trim().toLowerCase();
        if (name === "user-agent") applies = value === "*";
        else if (name === "disallow" && applies && value) prefixes.push(value);
      }
    }
  } catch {
    prefixes = [];
  }
  robotsCache.set(origin, prefixes);
  return prefixes;
}

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

type Fetched = { kind: "html"; body: string } | { kind: "pdf"; body: Uint8Array };

/** Fetch a public HTML page or PDF; SSRF-guarded, robots-aware, redirects re-validated. */
async function fetchPublic(target: string): Promise<Fetched> {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new ToolError("invalid_input", `Not a valid URL: ${target}`);
  }
  for (let hop = 0; ; hop++) {
    await assertPublic(url);
    const path = url.pathname + url.search;
    if ((await disallowedPrefixes(url.origin)).some((p) => path.startsWith(p))) {
      throw new ToolError("disallowed_by_robots", `robots.txt on ${url.origin} disallows fetching ${url.pathname}`);
    }
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/pdf" },
      signal: AbortSignal.timeout(20_000),
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop >= MAX_REDIRECTS) throw new ToolError("upstream_error", "Too many redirects");
      url = new URL(location, url);
      continue;
    }
    if (res.status === 429) throw new ToolError("rate_limited", `${url.origin} rate limited the request`);
    if (!res.ok) throw new ToolError("upstream_error", `${url.href} returned HTTP ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (/html/i.test(type)) return { kind: "html", body: (await res.text()).slice(0, MAX_BYTES) };
    if (/application\/pdf/i.test(type)) return { kind: "pdf", body: new Uint8Array(await res.arrayBuffer()).slice(0, MAX_BYTES) };
    throw new ToolError("unsupported_content", `Unsupported content type "${type}"; only HTML pages and PDFs can be read`);
  }
}

/** Fetch raw HTML from a public page. */
export async function fetchHtml(target: string): Promise<string> {
  const page = await fetchPublic(target);
  if (page.kind !== "html") throw new ToolError("unsupported_content", "Expected an HTML page but the URL is a PDF");
  return page.body;
}

/** Fetch a public web page or PDF and return its readable text. */
export async function fetchPage(input: { url: string; maxChars: number }): Promise<FetchedPage> {
  const page = await fetchPublic(input.url);
  let title: string;
  let text: string;
  if (page.kind === "html") {
    text = readableText(page.body);
    title = extractTitle(page.body);
  } else {
    try {
      ({ text } = await extractText(await getDocumentProxy(page.body), { mergePages: true }));
    } catch {
      throw new ToolError("upstream_error", `${input.url} could not be read as a PDF`);
    }
    title = text.split("\n").find((l) => l.trim())?.trim() ?? new URL(input.url).pathname.split("/").filter(Boolean).pop() ?? "";
  }
  return { url: input.url, title, text: text.slice(0, input.maxChars), truncated: text.length > input.maxChars };
}
