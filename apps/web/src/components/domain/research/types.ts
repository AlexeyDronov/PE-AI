import type { ResourceData } from "@/lib/api/types";

export type ReportSummary = ResourceData<"researchReports">["items"][number];
export type ReportDetailData = ResourceData<"researchReport">;
export type Finding = ReportDetailData["findings"][number];
export type Source = ReportDetailData["sources"][number];
