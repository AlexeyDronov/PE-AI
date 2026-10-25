import { Agent } from "@mastra/core/agent";
import type { Config, ModelRole } from "../config";
import { modelFor } from "../llm";
import { buildInstructions, type SkillName } from "../skills";
import { buildTools } from "../tools";
import { createSourceRegistry } from "../tools/recordSource";

export interface AgentDefinition {
  role: ModelRole;
  instructions: string;
  tools: Record<string, ReturnType<typeof buildTools>[keyof ReturnType<typeof buildTools>]>;
}

const RESEARCH_SKILLS: SkillName[] = ["sizing-a-market", "finding-deal-comps", "pe-screening-criteria", "citing-sources"];

const RESEARCHER_BASE = `You are the research agent for Harrowgate, a mid-market private equity fund investing in UK and European tech-enabled services (testing, inspection and certification, compliance, payroll BPO, IT and cyber, data services, engineering and facilities-management technology, legal operations). Research the question you are given using your tools, work methodically, and report findings with ranges, confidence and cited sources. Be concise and specific; state clearly what you could not find.`;

const ANALYST_BASE = `You are an investment analyst at Harrowgate, a mid-market private equity fund investing in UK and European tech-enabled services. Given research findings and the fund's internal data, extract structured facts and draft clear, balanced assessments. Use the calculator for all arithmetic. Do not add facts that are not in the material you are given or in internal data.`;

/** Fresh tools (and source registry) per call: build one definition per job. */
export function researcherDefinition(config: Config): AgentDefinition {
  return {
    role: "research",
    instructions: buildInstructions(RESEARCHER_BASE, RESEARCH_SKILLS),
    tools: buildTools({ config, sources: createSourceRegistry() }),
  };
}

export function analystDefinition(config: Config): AgentDefinition {
  const { internalData, calculator } = buildTools({ config, sources: createSourceRegistry() });
  return {
    role: "extract",
    instructions: buildInstructions(ANALYST_BASE, ["pe-screening-criteria"]),
    tools: { internalData, calculator },
  };
}

function toAgent(id: string, name: string, def: AgentDefinition, config: Config) {
  return new Agent({
    id,
    name,
    instructions: def.instructions,
    model: () => modelFor(def.role, config),
    tools: def.tools,
  });
}

export const marketResearcher = (config: Config) =>
  toAgent("market-researcher", "Market Researcher", researcherDefinition(config), config);

export const analyst = (config: Config) => toAgent("analyst", "Analyst", analystDefinition(config), config);
