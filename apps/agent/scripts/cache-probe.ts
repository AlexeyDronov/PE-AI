/** Sends one representative request twice and fails unless the second reads the prompt cache. Spends real tokens: run by hand. */
import { resolve } from "node:path";
import { z } from "zod";
import { loadConfig, loadEnvFiles } from "../src/config";
import { callClaude } from "../src/llm";
import { buildInstructions } from "../src/skills";

loadEnvFiles([resolve(process.cwd(), "../../.env"), resolve(process.cwd(), ".env")]);
const config = loadConfig({ API_URL: "http://unused", AGENT_SERVICE_TOKEN: "unused", ...process.env });

const system = buildInstructions("You are the research agent for Harrowgate, a mid-market private equity fund.", [
  "sizing-a-market",
  "finding-deal-comps",
  "pe-screening-criteria",
  "citing-sources",
]);
const schema = z.object({ ok: z.boolean() });
const probe = () => callClaude({ config, system, prompt: 'Reply with {"ok": true}.', schema, maxTokens: 500 });

const first = await probe();
const second = await probe();
console.log("first ", first.usage);
console.log("second", second.usage);
if (second.usage.cacheReadTokens <= 0) {
  console.error("FAIL: the second call did not read from the prompt cache");
  process.exit(1);
}
console.log("OK: prompt cache hit");
