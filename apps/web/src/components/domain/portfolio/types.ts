import type { ResourceData } from "@/lib/api/types";

export type Platform = ResourceData<"portfolioCompanies">["items"][number];
export type PlatformDetail = ResourceData<"portfolioCompany">;
export type PortfolioSummary = ResourceData<"portfolioSummary">;
export type Facility = ResourceData<"debtFacilities">["items"][number];
export type ValueStep = PortfolioSummary["value_bridge"][number];
