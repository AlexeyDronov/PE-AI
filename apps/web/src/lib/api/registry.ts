type ResourceDef = { path: string; resource: string; method?: "GET" | "POST" };

/** The only place endpoints are named. `resource` is the server's name for live invalidation. */
export const resources = {
  segments: { path: "/segments", resource: "segments" },
  segment: { path: "/segments/{id}", resource: "segments" },
  marketSummary: { path: "/market-summary", resource: "segments" },
  overviewSummary: { path: "/overview-summary", resource: "deals" },
  deals: { path: "/deals", resource: "deals" },
  deal: { path: "/deals/{id}", resource: "deals" },
  companies: { path: "/companies", resource: "companies" },
  portfolioCompanies: { path: "/portfolio-companies", resource: "portfolio-companies" },
  portfolioCompany: { path: "/portfolio-companies/{id}", resource: "portfolio-companies" },
  portfolioSummary: { path: "/portfolio-summary", resource: "portfolio-companies" },
  covenantSummary: { path: "/covenant-summary", resource: "debt-facilities" },
  kpiPoints: { path: "/kpi-points", resource: "kpi-points" },
  alerts: { path: "/alerts", resource: "alerts" },
  funds: { path: "/funds", resource: "funds" },
  fundCashflows: { path: "/fund-cashflows", resource: "fund-cashflows" },
  transactions: { path: "/transactions", resource: "transactions" },
  benchmarks: { path: "/benchmarks", resource: "benchmarks" },
  screeningCriteria: { path: "/screening-criteria", resource: "screening-criteria" },
  debtFacilities: { path: "/debt-facilities", resource: "debt-facilities" },
  valueCreationItems: { path: "/value-creation-items", resource: "value-creation-items" },
  exitPlans: { path: "/exit-plans", resource: "exit-plans" },
  exitSummary: { path: "/exit-summary", resource: "exit-plans" },
  exitRouteMixes: { path: "/exit-route-mixes", resource: "exit-route-mixes" },
  researchReports: { path: "/research-reports", resource: "research-reports" },
  researchReport: { path: "/research-reports/{id}", resource: "research-reports" },
  researchFindings: { path: "/research-findings", resource: "research-findings" },
  sources: { path: "/sources", resource: "sources" },
  memos: { path: "/memos", resource: "memos" },
  memo: { path: "/memos/{id}", resource: "memos" },
  memoOutline: { path: "/memo-outline", resource: "memos" },
  job: { path: "/jobs/{id}", resource: "jobs" },
  jobs: { path: "/jobs", resource: "jobs" },
  pipelineSummary: { path: "/pipeline-summary", resource: "deals" },
  lbo: { path: "/compute/lbo", resource: "deals", method: "POST" },
  lboSensitivity: { path: "/compute/lbo-sensitivity", resource: "deals", method: "POST" },
  valuationRange: { path: "/compute/valuation-range", resource: "deals", method: "POST" },
  lboScenarios: { path: "/lbo-scenarios", resource: "lbo-scenarios" },
  debtCapacity: { path: "/compute/debt-capacity", resource: "deals", method: "POST" },
} as const satisfies Record<string, ResourceDef>;

export const commands = {
  startMarketResearch: "/commands/start-market-research",
  setWatchlist: "/commands/set-watchlist",
  saveScenario: "/commands/save-scenario",
  screenTeaser: "/commands/screen-teaser",
  draftMemo: "/commands/draft-memo",
} as const satisfies Record<string, string>;

export type ResourceKey = keyof typeof resources;
export type CommandKey = keyof typeof commands;

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonicalise(v)]),
    );
  }
  return value;
}

/** Stable JSON for params: object key order does not matter. */
export function canonical(params: unknown): string {
  return JSON.stringify(canonicalise(params ?? null));
}

export function resourceKey(key: ResourceKey, params: unknown) {
  return ["resource", key, canonical(params)] as const;
}
