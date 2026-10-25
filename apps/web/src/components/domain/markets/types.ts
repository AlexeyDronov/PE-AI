import type { ResourceData } from "@/lib/api/types";

export type Segment = ResourceData<"segments">["items"][number];
export type SegmentDetail = ResourceData<"segment">;
export type Transaction = SegmentDetail["transactions"][number];
export type Player = SegmentDetail["players"][number];
export type Report = SegmentDetail["reports"][number];
export type MatchingDeal = SegmentDetail["matching_deals"][number];
