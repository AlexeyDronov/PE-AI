import { z } from "zod";
import { ToolError } from "../errors";

export interface Company {
  name: string;
  number: string;
  status: string;
  incorporated: string | null;
  address: string;
}

const response = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      company_number: z.string(),
      company_status: z.string().optional(),
      date_of_creation: z.string().optional(),
      address_snippet: z.string().optional(),
    }),
  ),
});

/** Search UK Companies House by company name. */
export async function searchCompanies(input: { query: string }, apiKey: string | undefined): Promise<{ companies: Company[] }> {
  if (!apiKey) throw new ToolError("not_configured", "Companies House is not configured: set COMPANIES_HOUSE_API_KEY");
  const url = new URL("https://api.company-information.service.gov.uk/search/companies");
  url.searchParams.set("q", input.query);
  const res = await fetch(url, {
    headers: { authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 429) throw new ToolError("rate_limited", "Companies House rate limit reached; retry later");
  if (!res.ok) throw new ToolError("upstream_error", `Companies House returned HTTP ${res.status}`);
  const parsed = response.safeParse(await res.json());
  if (!parsed.success) throw new ToolError("upstream_error", "Companies House returned an unexpected response");
  return {
    companies: parsed.data.items.map((i) => ({
      name: i.title,
      number: i.company_number,
      status: i.company_status ?? "unknown",
      incorporated: i.date_of_creation ?? null,
      address: i.address_snippet ?? "",
    })),
  };
}
