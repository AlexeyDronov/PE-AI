import { z } from "zod";
import type { JobRunner } from "../jobs";
import { callClaude, LlmError, type Usage } from "../llm";
import { buildInstructions } from "../skills";
import { readInternal } from "../tools/internalData";

const MIN_CHARS = 200;
const MAX_CHARS = 36_000; // ~12k tokens at 3 characters per token

const BASE = `You screen private-equity deal teasers for Harrowgate, a UK mid-market buyout investor. Read the teaser the user supplies and extract a structured record of the opportunity. Return only the structured record.

Rules for every field:
- company.name: the target's trading name; if the teaser only gives a code name, use a short descriptor of the business and do not repeat the code name. company.description is one sentence on what it does and for whom. company.hq is the head-office town or city. company.ownership describes the current owner, for example "Founder-owned" or "PE-backed (year 3)". company.moat is the one-line source of durable advantage.
- segment: choose exactly ONE of the segment names listed in the user message, copied character for character. Pick the closest fit by what the business sells, not by where it sells.
- code_name: the project name used in the teaser, or a short "Project X" style label if none is given. process: how the opportunity is being run, such as adviser-led auction, bilateral or pre-emptive approach.
- ask_multiple: the EV/EBITDA multiple the seller asks for, only if the teaser states a price or a multiple. Otherwise return null. Never invent a price.
- financials.revenue and financials.ebitda are the latest full-year figures in pounds sterling millions (GBP m), for example 48 for £48m. Convert other currencies and units at a sensible rate and say so in a diligence question. EBITDA must be positive and below revenue.
- Every rate and percentage is a FRACTION between 0 and 1, never a whole percentage: 14% is 0.14, 82% is 0.82. This applies to growth (annual revenue growth, which may be negative, above -0.5 and below 2), recurring_pct (share of revenue that is contracted or repeat), capex_pct, da_pct (depreciation and amortisation) and nwc_pct (net working capital), each as a share of revenue, top_customer_pct (the largest customer's share of revenue) and gross_retention (share of prior-year revenue kept from existing customers).
- financials.cyclicality is exactly one of Low, Medium or High, reflecting how far demand swings with the economic cycle.
- financials.ai_resilience is an integer from 0 to 100: how well the business withstands generative AI and automation (100 means very safe, 0 means the product or labour model is easily replaced). financials.fragmentation is an integer from 0 to 100: how fragmented the segment is, which indicates room for buy-and-build (100 means highly fragmented).
- financials.key_person_risk is true when the business depends heavily on a founder or a few individuals for sales, relationships or delivery.
- For any figure the teaser does not state, give your best estimate from the rest of the teaser and typical values for the sector, and add a diligence question asking for the real number.
- risk_flags: at most 8. Each has a severity of h (high), m (medium) or l (low), a short text naming the risk, and a mitigant that says how a buyer could reduce it. Order from most to least severe.
- diligence_questions: between 1 and 10 specific questions that the first management meeting must answer, most important first. Each is a full question ending in a question mark.

Keep all text concise and factual, in British English. Do not repeat the teaser verbatim, and do not add commentary outside the record.`;

/** Frozen at module load: this is the cached prefix, so nothing teaser-specific may ever be added. */
export const SYSTEM = buildInstructions(BASE, ["pe-screening-criteria"]);

const fraction = z.number().min(0).max(1);
const score = z.number().int().min(0).max(100);

// Static on purpose: the segment list goes in the user turn so the request prefix stays cacheable.
export const extraction = z.object({
  company: z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(400),
    hq: z.string().max(80),
    ownership: z.string().max(120),
    moat: z.string().max(300),
  }),
  segment: z.string().min(1),
  code_name: z.string().min(1).max(80),
  process: z.string().max(200),
  ask_multiple: z.number().positive().max(60).nullable(),
  financials: z.object({
    revenue: z.number().positive(),
    ebitda: z.number().positive(),
    growth: z.number().min(-0.5).max(2),
    recurring_pct: fraction,
    capex_pct: fraction,
    da_pct: fraction,
    nwc_pct: fraction,
    top_customer_pct: fraction,
    gross_retention: fraction,
    cyclicality: z.enum(["Low", "Medium", "High"]),
    ai_resilience: score,
    fragmentation: score,
    key_person_risk: z.boolean(),
  }),
  risk_flags: z
    .array(z.object({ severity: z.enum(["h", "m", "l"]), text: z.string().max(300), mitigant: z.string().max(300) }))
    .max(8),
  diligence_questions: z.array(z.string().max(300)).min(1).max(10),
});

export const teaserScreen: JobRunner = async (jobId, input, { config, callbacks }) => {
  const text = String(input.text ?? "").trim();
  if (text.length < MIN_CHARS) return callbacks.fail(jobId, `Teaser is too short to screen: paste at least ${MIN_CHARS} characters.`);
  if (text.length > MAX_CHARS) return callbacks.fail(jobId, `Teaser is too long to screen: keep it under ${MAX_CHARS} characters.`);

  let usage: Usage | undefined;
  try {
    await callbacks.progress(jobId, "segments", "Loading segments");
    const body = (await readInternal({ resource: "segments", params: {} }, config.apiUrl)) as { items: { short: string }[] };
    const shorts = body.items.map((s) => s.short);

    await callbacks.progress(jobId, "extract", "Reading the teaser");
    const call = await callClaude({
      config,
      system: SYSTEM,
      prompt: `Segments (choose exactly one): ${shorts.join(", ")}\n\nTeaser:\n${text}`,
      schema: extraction,
      maxTokens: 6000, // output ~1k tokens; the rest is headroom for adaptive thinking
    });
    usage = call.usage;
    const { data } = call;

    if (!shorts.includes(data.segment)) throw new Error(`Claude chose a segment we do not cover: "${data.segment}".`);
    if (data.financials.ebitda >= data.financials.revenue) throw new Error("Extracted EBITDA is not below revenue, so the figures are unreliable.");

    await callbacks.result(jobId, data, usage);
  } catch (err) {
    if (err instanceof LlmError) usage = err.usage;
    await callbacks.fail(jobId, err instanceof Error ? err.message : String(err), usage);
  }
};
