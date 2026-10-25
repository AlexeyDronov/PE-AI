import { registerApiRoute } from "@mastra/core/server";
import { ApiCallbacks } from "../callbacks";
import { loadConfig } from "../config";
import { handleStartJob, jobRunners } from "../jobs";

// Built on first request so importing the module never needs the environment.
let deps: Parameters<typeof handleStartJob>[1] | undefined;
function getDeps() {
  if (!deps) {
    const config = loadConfig();
    deps = { config, callbacks: new ApiCallbacks(config), runners: jobRunners };
  }
  return deps;
}

export const apiRoutes = [
  registerApiRoute("/jobs/:kind/start", {
    method: "POST",
    handler: async (c) => {
      const body: unknown = await c.req.json().catch(() => undefined);
      const { status, body: payload } = await handleStartJob(
        { kind: c.req.param("kind"), authorization: c.req.header("authorization"), body },
        getDeps(),
      );
      return c.json(payload, status);
    },
  }),
  registerApiRoute("/health", { method: "GET", handler: async (c) => c.json({ status: "ok" }) }),
];
