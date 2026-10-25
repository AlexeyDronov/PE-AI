import type { ResourceData } from "@/lib/api/types";

export type ExitPlan = ResourceData<"exitPlans">["items"][number];
export type ExitRouteMix = ResourceData<"exitRouteMixes">["items"][number];
