import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SKILLS = ["sizing-a-market", "finding-deal-comps", "pe-screening-criteria", "citing-sources"] as const;
export type SkillName = (typeof SKILLS)[number];

export const CITATION_RULE = "Every number you report must cite a recorded source.";

/**
 * Playbooks live in src/mastra/public. Candidate dirs, relative to this module: the bundle's own folder (mastra
 * build copies public/ there), the source tree from `.mastra/output` (mastra dev does not copy), and from src/skills.
 */
const PLAYBOOK_DIRS = ["./", "../../src/mastra/public/", "../mastra/public/"].map((d) => new URL(d, import.meta.url));

/** Read a playbook's markdown from the first candidate dir that has it. */
export function loadSkill(name: SkillName): string {
  const dir = PLAYBOOK_DIRS.find((d) => existsSync(new URL(`${name}.md`, d))) ?? PLAYBOOK_DIRS[2];
  return readFileSync(fileURLToPath(new URL(`${name}.md`, dir)), "utf8").trim();
}

/** Base instructions, then each playbook, separated by blank lines, ending with the citation rule. */
export function buildInstructions(base: string, skills: readonly SkillName[]): string {
  return [base.trim(), ...skills.map(loadSkill), CITATION_RULE].join("\n\n");
}
