import { jobRunners } from "../jobs";
import { marketResearch } from "./marketResearch";
import { teaserScreen } from "./teaserScreen";

/** Register every implemented job runner. Called explicitly by the server: the bundler drops side-effect-only imports. */
export function registerJobRunners() {
  jobRunners.teaser_screen = teaserScreen;
  jobRunners.market_research = marketResearch;
  return jobRunners;
}

registerJobRunners();
