/** 7.6: deterministic research helpers — query planning, passage filtering and citation checks done in code, not by the model. */
import { describe, expect, it } from "vitest";
import { filterPassages, numberAppears, planQueries, verifyFindings } from "@/workflows/research";

describe("planQueries", () => {
  it("starts with the question and adds template queries matching its intent, at most 4 distinct", () => {
    const q = planQueries("How big is the UK compliance outsourcing market and how fast is it growing?", { segment: "Compliance", year: 2026 });
    expect(q[0]).toBe("How big is the UK compliance outsourcing market and how fast is it growing?");
    expect(q.length).toBeLessThanOrEqual(4);
    expect(new Set(q).size).toBe(q.length);
    expect(q.slice(1).join(" ")).toMatch(/market size/i);
  });

  it("uses deal-comps templates for valuation questions", () => {
    const q = planQueries("What EV/EBITDA multiples have PE buyers paid for TIC acquisitions?", { segment: "TIC", year: 2026 });
    expect(q.slice(1).join(" ")).toMatch(/multiple/i);
  });

  it("falls back to market-size templates when nothing matches", () => {
    const q = planQueries("Tell me about payroll", { segment: "Payroll BPO", year: 2026 });
    expect(q.length).toBeGreaterThan(1);
    expect(q.slice(1).join(" ")).toMatch(/market size/i);
  });
});

describe("filterPassages", () => {
  const page = [
    "Accept cookies to continue. Subscribe to our newsletter.",
    "The UK compliance outsourcing market reached £9.1bn in 2026, according to the survey.",
    "Our offices are open Monday to Friday.",
    "Demand is expected to grow 11% a year to 2030 as regulation tightens.",
    "Compliance outsourcing providers are consolidating rapidly.",
  ].join("\n\n");

  it("keeps passages that mention the question's terms or contain figures, in page order", () => {
    const out = filterPassages(page, "How big is the UK compliance outsourcing market?");
    expect(out).toContain("£9.1bn");
    expect(out).toContain("11% a year");
    expect(out).toContain("consolidating rapidly");
    expect(out).not.toMatch(/cookies|Monday/);
    expect(out.indexOf("£9.1bn")).toBeLessThan(out.indexOf("11% a year"));
  });

  it("caps the excerpt length (~1,500 tokens)", () => {
    const long = Array.from({ length: 400 }, (_, i) => `Compliance market figure ${i} is £${i}m.`).join("\n\n");
    expect(filterPassages(long, "compliance market").length).toBeLessThanOrEqual(4500);
  });
});

describe("numberAppears", () => {
  it("matches the value as written in the text", () => {
    expect(numberAppears(9.1, "reached £9.1bn in 2026")).toBe(true);
    expect(numberAppears(11, "grow 11% a year")).toBe(true);
    expect(numberAppears(11.0, "grow 11.0% a year")).toBe(true);
    expect(numberAppears(1200, "about 1,200 firms")).toBe(true);
    expect(numberAppears(0.5, "margin of 0.5 points")).toBe(true);
  });

  it("does not match a different number or part of one", () => {
    expect(numberAppears(9.1, "reached £19.1bn")).toBe(false);
    expect(numberAppears(1, "grew 11%")).toBe(false);
    expect(numberAppears(42, "no figures here")).toBe(false);
  });
});

describe("verifyFindings", () => {
  const sources = [
    { ref: 1, url: "https://a.example/x", title: "A", publisher: "a.example", excerpt: "The UK compliance outsourcing market reached £9.1bn in 2026." },
    { ref: 2, url: "https://b.example/y", title: "B", publisher: "b.example", excerpt: "Demand is expected to grow 11% a year to 2030." },
  ];
  const finding = (over: Record<string, unknown>) => ({
    metric: "Market size",
    value: 9.1,
    unit: "£bn",
    period: "2026",
    confidence: "medium" as const,
    source_refs: [1],
    quote: "The UK compliance outsourcing market reached £9.1bn in 2026.",
    ...over,
  });

  it("keeps findings whose quote is in a cited source and contains the value", () => {
    const { kept, dropped } = verifyFindings([finding({})], sources);
    expect(kept).toHaveLength(1);
    expect(dropped).toEqual([]);
  });

  it("tolerates whitespace and case differences in the quote", () => {
    const { kept } = verifyFindings([finding({ quote: "the UK compliance   outsourcing market reached £9.1bn in 2026" })], sources);
    expect(kept).toHaveLength(1);
  });

  it("drops findings whose number is not in the quote, whose quote is not in the cited source, or that cite unknown refs", () => {
    const { kept, dropped } = verifyFindings(
      [
        finding({ value: 42 }),
        finding({ source_refs: [2] }),
        finding({ source_refs: [9] }),
        finding({ metric: "CAGR", value: 11, unit: "%", source_refs: [2], quote: "Demand is expected to grow 11% a year to 2030." }),
      ],
      sources,
    );
    expect(kept.map((f) => f.metric)).toEqual(["CAGR"]);
    expect(dropped).toHaveLength(3);
  });
});
