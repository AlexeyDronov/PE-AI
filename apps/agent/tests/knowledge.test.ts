/** 7.3: query templates, skill playbooks and the agents built from them. */
import { describe, expect, it } from "vitest";
import { analyst, analystDefinition, marketResearcher, researcherDefinition } from "@/agents";
import { QUERY_TEMPLATES, queriesFor } from "@/queries";
import { SKILLS, buildInstructions, loadSkill } from "@/skills";
import { testConfig } from "./helpers";

const ctx = { segment: "Compliance outsourcing", geography: "UK", year: 2026 };

describe("query templates", () => {
  it("covers the research jobs the agent does", () => {
    expect(Object.keys(QUERY_TEMPLATES).sort()).toEqual(["aiDisruption", "dealComps", "marketSize", "regulation", "sponsorActivity"]);
  });

  it.each(Object.keys(QUERY_TEMPLATES))("%s yields 3–6 distinct, specific, short queries", (name) => {
    const qs = queriesFor(name as keyof typeof QUERY_TEMPLATES, ctx);
    expect(qs.length).toBeGreaterThanOrEqual(3);
    expect(qs.length).toBeLessThanOrEqual(6);
    expect(new Set(qs).size).toBe(qs.length);
    for (const q of qs) {
      expect(q).toContain("Compliance outsourcing");
      expect(q.length).toBeLessThanOrEqual(200);
    }
    expect(qs.some((q) => q.includes("UK"))).toBe(true);
  });

  it("asks the right questions for each job", () => {
    expect(queriesFor("marketSize", ctx).some((q) => /market size/i.test(q))).toBe(true);
    expect(queriesFor("marketSize", ctx).some((q) => q.includes("2026"))).toBe(true);
    expect(queriesFor("dealComps", ctx).some((q) => /acqui/i.test(q))).toBe(true);
    expect(queriesFor("dealComps", ctx).some((q) => /EV\/EBITDA|multiple/i.test(q))).toBe(true);
    expect(queriesFor("aiDisruption", ctx).some((q) => /AI|automation/.test(q))).toBe(true);
  });
});

describe("skills", () => {
  it("ships the four playbooks named in the architecture", () => {
    expect(SKILLS).toEqual(["sizing-a-market", "finding-deal-comps", "pe-screening-criteria", "citing-sources"]);
    for (const s of SKILLS) {
      const md = loadSkill(s);
      expect(md.startsWith("# "), s).toBe(true);
      expect(md.length, s).toBeGreaterThan(300);
    }
  });

  it("composes instructions from a base and skills, always ending with the citation rule", () => {
    const text = buildInstructions("You are a research analyst.", ["sizing-a-market"]);
    expect(text.startsWith("You are a research analyst.")).toBe(true);
    expect(text).toContain(loadSkill("sizing-a-market"));
    expect(text.trimEnd().endsWith("Every number you report must cite a recorded source.")).toBe(true);
  });
});

describe("agents", () => {
  it("the market researcher has every research tool and the research playbooks", () => {
    const def = researcherDefinition(testConfig());
    expect(Object.keys(def.tools).sort()).toEqual(
      ["calculator", "companyRegistry", "extractTables", "fetchPage", "fxRates", "internalData", "recordSource", "secFilings", "webSearch"].sort(),
    );
    for (const heading of ["# Sizing a market", "# Finding deal comps", "# Citing sources"]) expect(def.instructions).toContain(heading);
    expect(def.role).toBe("research");
  });

  it("the analyst extracts and drafts with a narrow tool set", () => {
    const def = analystDefinition(testConfig());
    expect(Object.keys(def.tools).sort()).toEqual(["calculator", "internalData"]);
    expect(def.instructions).toContain("# PE screening criteria");
    expect(def.role).toBe("extract");
  });

  it("agents can be constructed without any provider keys (models resolve lazily)", () => {
    const noKeys = testConfig({ OPENROUTER_API_KEY: undefined, TAVILY_API_KEY: undefined });
    expect(() => marketResearcher(noKeys)).not.toThrow();
    expect(() => analyst(noKeys)).not.toThrow();
    expect(marketResearcher(noKeys).id).toBe("market-researcher");
    expect(analyst(noKeys).id).toBe("analyst");
  });
});
