import { jobRunners } from "../jobs";
import { teaserScreen } from "./teaserScreen";

/** Register every implemented job runner. Called explicitly by the server: the bundler drops side-effect-only imports. */
export function registerJobRunners() {
  jobRunners.teaser_screen = teaserScreen;
  return jobRunners;
}

registerJobRunners();
