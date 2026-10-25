import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Config, ModelRole } from "./config";
import { MissingKeyError } from "./errors";

/** The OpenRouter model configured for a role; needs OPENROUTER_API_KEY only when called. */
export function modelFor(role: ModelRole, config: Config) {
  if (!config.keys.openrouter) throw new MissingKeyError("OPENROUTER_API_KEY");
  return createOpenRouter({ apiKey: config.keys.openrouter })(config.models[role]);
}
