import { z } from "zod";
import type { JobRunner } from "../jobs";
import { callClaude, LlmError, type Usage } from "../llm";
import { buildInstructions } from "../skills";

const SECTION_GUIDE = {
  summary: "Summary: the opportunity in one paragraph (what the business does, size, ask), the headline returns against the hurdle, the screening verdict and the recommendation in brief.",
  thesis: "Investment thesis: why this is an attractive buyout, the moat, the growth drivers and where value creation will come from (growth, margin, multiple, deleveraging).",
  market: "Market: the segment, its growth and fragmentation, competitive position and cyclicality. Use only what the context supports and say when evidence is thin.",
  financials: "Financials: revenue, EBITDA and margin, growth, recurring revenue, customer concentration, retention, capex and working capital, and what they say about earnings quality.",
  valuation: "Valuation and returns: entry multiple against the segment, leverage and debt capacity, sources and uses, IRR and MOIC against the hurdle, the maximum bid, and the range across the sensitivity grid.",
  risks: "Risks: the main risks by severity with their mitigants, the risk checks that are flagged or on watch, and the diligence questions that matter most.",
  recommendation: "Recommendation: advance, watch or pass with the reasoning, the conditions to proceed and the first diligence priorities.",
} as const;

const KEYS = Object.keys(SECTION_GUIDE) as [keyof typeof SECTION_GUIDE, ...(keyof typeof SECTION_GUIDE)[]];

const BASE = `You write investment committee (IC) memo sections for Harrowgate, a UK mid-market buyout investor. The user message lists the sections to write, in order, followed by a compact JSON summary of the deal: company facts, financials, screening scorecard, risk flags and checks, diligence questions, debt capacity, LBO case and returns, and the range of the IRR sensitivity grid. Write only the requested sections and return only the structured record.

Rules for every section:
- Write in British English, in the measured, direct voice of an investment professional addressing the committee. Be concise: a short paragraph or a few tight bullets per point, and no filler or marketing language.
- The markdown of each section starts with a level-two heading, "## <Title>", using the section's title from the guide below, followed by the body. Use bullets and bold sparingly. Never use level-one headings, tables or code fences, and never repeat the heading of another section.
- Use only figures that appear in the JSON context. Never invent, estimate, round to a different precision or derive a number the context does not give. If a figure you need is missing, say it is not available and name it as a diligence item.
- State every figure with its unit. Money is in pounds sterling millions, written as £m (for example £61.0m). Multiples are written with "x" (for example 15.5x). Rates, margins, growth, IRR and shares are fractions in the context and must be converted to percentages (0.231 becomes 23.1%). MOIC is a multiple (2.8x). Scores are out of 100.
- Compare returns to the hurdle (the "hurdle" field is a fractional IRR) and say plainly whether the deal clears it. When the context names a saved scenario, say that the returns are for that scenario and case.
- Keep sections consistent with each other and with the screening verdict. Do not recommend advancing a deal the scorecard passes without saying why.
- Length budget: each section is 120 to 250 words, and the whole memo stays under 1,500 words. Prefer tight bullets for figures and risks.

Section guide (the user message selects which of these to write):
${KEYS.map((k) => `- ${k}: ${SECTION_GUIDE[k]}`).join("\n")}`;

/** Frozen at module load: the section guide covers all seven keys, so the cached prefix never changes with the selection. */
export const SYSTEM = buildInstructions(BASE, ["pe-screening-criteria"]);

export const memo = z.object({
  sections: z.array(z.object({ key: z.enum(KEYS), markdown: z.string().min(1).max(8000) })).min(1).max(KEYS.length),
});

export const memoDraft: JobRunner = async (jobId, input, { config, callbacks }) => {
  const sections = Array.isArray(input.sections) ? input.sections.map(String) : [];
  const context = input.context;
  if (sections.length === 0) return callbacks.fail(jobId, "No memo sections were requested.");
  if (new Set(sections).size !== sections.length || sections.some((s) => !(s in SECTION_GUIDE))) {
    return callbacks.fail(jobId, `Invalid memo sections requested. Known sections: ${KEYS.join(", ")}.`);
  }
  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    return callbacks.fail(jobId, "The memo job has no deal context to write from.");
  }

  let usage: Usage | undefined;
  try {
    await callbacks.progress(jobId, "draft", "Drafting the memo");
    const call = await callClaude({
      config,
      system: SYSTEM,
      prompt: `Sections to write, in order: ${sections.join(", ")}\n\nDeal context (JSON):\n${JSON.stringify(context)}`,
      schema: memo,
      maxTokens: 10_000, // room for adaptive thinking plus ~2k tokens of memo
    });
    usage = call.usage;

    const byKey = new Map(call.data.sections.map((s) => [s.key as string, s]));
    if (byKey.size !== call.data.sections.length || byKey.size !== sections.length || sections.some((k) => !byKey.has(k))) {
      throw new Error(`Claude did not return exactly the requested sections (${sections.join(", ")}); got ${call.data.sections.map((s) => s.key).join(", ")}.`);
    }
    await callbacks.result(jobId, { sections: sections.map((k) => byKey.get(k)!) }, usage);
  } catch (err) {
    if (err instanceof LlmError) usage = err.usage;
    await callbacks.fail(jobId, err instanceof Error ? err.message : String(err), usage);
  }
};
