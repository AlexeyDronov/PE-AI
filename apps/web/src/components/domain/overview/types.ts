import type { ResourceData } from "@/lib/api/types";

export type Alert = ResourceData<"alerts">["items"][number];
