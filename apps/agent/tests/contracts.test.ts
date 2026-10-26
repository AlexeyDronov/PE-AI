/**
 * Plan step 3.5: Zod schemas for the agent, generated from the API's OpenAPI document (`make codegen`), so the
 * agent checks its job results against the same contract the API enforces instead of a hand-written copy.
 */
import { describe, expect, it } from "vitest";
import { MarketResearchResult, MemoDraftResult, TeaserScreenResult } from "@contracts/schemas";
import { RESULT_SCHEMAS } from "@/contracts";

const TEASER = {
  company: { name: "Birchfield Payroll", description: "Payroll outsourcing.", hq: "Manchester", ownership: "Founder-owned", moat: "Contracts" },
  segment: "Payroll BPO",
  code_name: "Project Birch",
  process: "Teaser circulated by adviser",
  ask_multiple: null,
  financials: {
    revenue: 48, ebitda: 9.6, growth: 0.14, recurring_pct: 0.82, capex_pct: 0.03, da_pct: 0.04, nwc_pct: 0.05,
    top_customer_pct: 0.07, gross_retention: 0.94, cyclicality: "Low", ai_resilience: 55, fragmentation: 70, key_person_risk: true,
  },
  risk_flags: [{ severity: "m", text: "Founder runs sales", mitigant: "Hire a CRO" }],
  diligence_questions: ["What share of revenue is contracted?"],
};

const REPORT = {
  summary: "Outsourced KYC demand is growing.",
  findings: [{ metric: "Market size", value: 9.1, unit: "£bn", period: "2026", confidence: "medium", source_refs: [1] }],
  sources: [{ ref: 1, url: "https://example.org/a", title: "Report A", publisher: "Example", excerpt: "£9.1bn." }],
};

const MEMO = { sections: [{ key: "summary", markdown: "## Summary\n\nText." }] };

describe("generated contract schemas", () => {
  it("accept valid results of each job kind", () => {
    expect(TeaserScreenResult.safeParse(TEASER).success).toBe(true);
    expect(MarketResearchResult.safeParse(REPORT).success).toBe(true);
    expect(MemoDraftResult.safeParse(MEMO).success).toBe(true);
  });

  it("enforce the API's field constraints", () => {
    const pct = { ...TEASER, financials: { ...TEASER.financials, recurring_pct: 82 } };
    const severity = { ...TEASER, risk_flags: [{ ...TEASER.risk_flags[0]!, severity: "critical" }] };
    const cyclicality = { ...TEASER, financials: { ...TEASER.financials, cyclicality: "Very high" } };
    const noQuestions = { ...TEASER, diligence_questions: [] };
    expect(TeaserScreenResult.safeParse(pct).success).toBe(false);
    expect(TeaserScreenResult.safeParse(severity).success).toBe(false);
    expect(TeaserScreenResult.safeParse(cyclicality).success).toBe(false);
    expect(TeaserScreenResult.safeParse(noQuestions).success).toBe(false);

    const uncited = { ...REPORT, findings: [{ ...REPORT.findings[0]!, source_refs: [] }] };
    const certain = { ...REPORT, findings: [{ ...REPORT.findings[0]!, confidence: "certain" }] };
    expect(MarketResearchResult.safeParse(uncited).success).toBe(false);
    expect(MarketResearchResult.safeParse(certain).success).toBe(false);

    expect(MemoDraftResult.safeParse({ sections: [{ key: "summary", markdown: "" }] }).success).toBe(false);
    expect(MemoDraftResult.safeParse({ sections: [{ key: "poetry", markdown: "x" }] }).success).toBe(false);
  });

  it("map every agent job kind to its generated result schema", () => {
    expect(RESULT_SCHEMAS.teaser_screen).toBe(TeaserScreenResult);
    expect(RESULT_SCHEMAS.market_research).toBe(MarketResearchResult);
    expect(RESULT_SCHEMAS.memo_draft).toBe(MemoDraftResult);
  });
});
