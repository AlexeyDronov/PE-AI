import { z } from "zod";
import { ToolError } from "../errors";

export interface Filing {
  company: string;
  cik: string;
  form: string;
  filed: string;
  url: string;
}

const response = z.object({
  hits: z.object({
    hits: z.array(
      z.object({
        _id: z.string(),
        _source: z.object({
          display_names: z.array(z.string()),
          form: z.string(),
          file_date: z.string(),
          ciks: z.array(z.string()),
          adsh: z.string(),
        }),
      }),
    ),
  }),
});

/** Full-text search of SEC EDGAR 10-K/10-Q filings (US-listed comparables). */
export async function searchFilings(input: { phrase: string; forms: string[] }, userAgent: string): Promise<{ filings: Filing[] }> {
  const url = new URL("https://efts.sec.gov/LATEST/search-index");
  url.searchParams.set("q", `"${input.phrase}"`);
  url.searchParams.set("forms", input.forms.join(","));
  const res = await fetch(url, { headers: { "user-agent": userAgent }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 429) throw new ToolError("rate_limited", "SEC EDGAR rate limit reached; retry later");
  if (!res.ok) throw new ToolError("upstream_error", `SEC EDGAR returned HTTP ${res.status}`);
  const parsed = response.safeParse(await res.json());
  if (!parsed.success) throw new ToolError("upstream_error", "SEC EDGAR returned an unexpected response");
  return {
    filings: parsed.data.hits.hits.flatMap((hit) => {
      const src = hit._source;
      const cik = src.ciks[0];
      const file = hit._id.split(":")[1];
      if (!cik || !file) return [];
      return [
        {
          company: (src.display_names[0] ?? "").replace(/\s*\(CIK[^)]*\)\s*$/, ""),
          cik,
          form: src.form,
          filed: src.file_date,
          url: `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, "")}/${src.adsh.replace(/-/g, "")}/${file}`,
        },
      ];
    }),
  };
}
