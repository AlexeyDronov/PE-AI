import type { ResourceData } from "@/lib/api/types";

export type Fund = ResourceData<"funds">["items"][number];
export type FundPoint = Fund["metrics"]["series"][number];
export type WaterfallTier = Fund["metrics"]["waterfall"][number];
