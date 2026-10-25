import type { Tone } from "@/components/ui";

/** Readable names for the kinds of Copilot job. */
const KIND_LABELS: Record<string, string> = {
  market_research: "Market research",
  teaser_screen: "Teaser screen",
  memo_draft: "IC memo draft",
};

export const jobKindLabel = (kind: string) => KIND_LABELS[kind] ?? kind;

export const JOB_STATUS_TONE: Record<string, Tone> = { queued: "neutral", running: "accent", succeeded: "good", failed: "bad" };
