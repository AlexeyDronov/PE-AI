import { Mastra } from "@mastra/core";
import type { Agent } from "@mastra/core/agent";
import { analyst, marketResearcher } from "../agents";
import { type Config, envFilesUpward, loadConfig, loadEnvFiles } from "../config";
import { apiRoutes } from "./routes";

// Agents need the environment; without it the module still imports cleanly and registers none.
// mastra dev runs from apps/agent; the repo-root .env holds the keys.
loadEnvFiles(envFilesUpward()); // mastra dev runs from .mastra/output, so search up to the repo root
let config: Config | undefined;
try {
  config = loadConfig();
} catch {
  config = undefined;
}

const agents: Record<string, Agent> = config
  ? { marketResearcher: marketResearcher(config), analyst: analyst(config) }
  : {};

/** Composition root: agents and workflows are registered here as they are built. */
export const mastra = new Mastra({
  agents,
  workflows: {},
  server: { port: config?.port ?? 4111, apiRoutes },
});
