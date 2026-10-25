import { z } from "zod";
import { ToolError } from "../errors";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate: string | null;
  score: number;
}

export interface SearchProvider {
  search(query: string, maxResults: number): Promise<SearchResult[]>;
}

const tavilyResponse = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      content: z.string(),
      score: z.number().optional(),
      published_date: z.string().nullish(),
    }),
  ),
});

export class TavilyProvider implements SearchProvider {
  constructor(private readonly apiKey: string) {}

  async search(query: string, maxResults: number): Promise<SearchResult[]> {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query, max_results: maxResults, search_depth: "advanced" }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429) throw new ToolError("rate_limited", "Tavily rate limit reached; retry later or reduce searches");
    if (!res.ok) throw new ToolError("upstream_error", `Tavily returned HTTP ${res.status}`);
    const parsed = tavilyResponse.safeParse(await res.json());
    if (!parsed.success) throw new ToolError("upstream_error", "Tavily returned an unexpected response");
    return parsed.data.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      publishedDate: r.published_date ?? null,
      score: r.score ?? 0,
    }));
  }
}

export const MAX_SEARCH_RESULTS = 10;

export async function searchWeb(
  input: { query: string; maxResults: number },
  provider: SearchProvider | null,
): Promise<{ results: SearchResult[] }> {
  if (!input.query.trim()) throw new ToolError("invalid_input", "query must not be empty");
  if (input.maxResults < 1 || input.maxResults > MAX_SEARCH_RESULTS) {
    throw new ToolError("invalid_input", `maxResults must be between 1 and ${MAX_SEARCH_RESULTS}`);
  }
  if (!provider) throw new ToolError("not_configured", "Web search is not configured: set TAVILY_API_KEY");
  return { results: await provider.search(input.query, input.maxResults) };
}
