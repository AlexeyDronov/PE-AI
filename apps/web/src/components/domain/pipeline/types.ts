import type { ResourceData } from "@/lib/api/types";

export type Deal = ResourceData<"deals">["items"][number];
export type PipelineSummary = ResourceData<"pipelineSummary">;
export type { Verdict } from "../verdict";
