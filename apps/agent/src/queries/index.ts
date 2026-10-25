export interface QueryContext {
  segment: string;
  geography: string;
  year: number;
}

export type QueryTemplate = (ctx: QueryContext) => string[];

/** Search queries a PE associate would type for each research job. */
export const QUERY_TEMPLATES = {
  marketSize: ({ segment, geography, year }) => [
    `${segment} market size ${geography} ${year}`,
    `${segment} market size and CAGR forecast ${year} to ${year + 5}`,
    `${geography} ${segment} industry revenue report ${year}`,
    `${segment} total addressable market Europe ${year} analyst report`,
    `${segment} outsourced vs in-house spend ${geography} penetration`,
  ],
  dealComps: ({ segment, geography, year }) => [
    `${segment} acquisitions ${geography} ${year} private equity EV/EBITDA`,
    `${segment} M&A transaction multiples ${year}`,
    `private equity acquires ${segment} company ${geography} deal value`,
    `${segment} buy-and-build add-on acquisitions ${geography} multiple paid`,
    `${segment} listed peers trading multiples EV/EBITDA ${year}`,
  ],
  sponsorActivity: ({ segment, geography, year }) => [
    `private equity ${segment} platform investments ${geography} ${year}`,
    `${segment} sponsor-backed companies ${geography} buyout`,
    `${segment} secondary buyout ${geography} ${year} PE exit`,
    `which private equity firms are active in ${segment} ${geography}`,
  ],
  regulation: ({ segment, geography, year }) => [
    `${segment} regulation ${geography} ${year} new requirements`,
    `${segment} regulatory drivers demand outsourcing ${geography}`,
    `${geography} legislation compliance deadline affecting ${segment} ${year}`,
    `${segment} regulator enforcement fines ${geography} ${year}`,
  ],
  aiDisruption: ({ segment, geography, year }) => [
    `${segment} AI disruption risk ${year}`,
    `generative AI automation impact on ${segment} providers ${geography}`,
    `${segment} AI-enabled competitors startups funding ${year}`,
    `${segment} labour-based business model automation threat margins`,
    `${segment} incumbents AI adoption pricing pressure ${geography}`,
  ],
} satisfies Record<string, QueryTemplate>;

export type QueryName = keyof typeof QUERY_TEMPLATES;

/** The distinct queries for a research job, in priority order. */
export function queriesFor(name: QueryName, ctx: QueryContext): string[] {
  return [...new Set(QUERY_TEMPLATES[name](ctx))];
}
