import type { ResourceData } from "@/lib/api/types";

export type DealDetail = ResourceData<"deal">;
export type Criterion = DealDetail["screening"]["criteria"][number];
export type RiskCheckItem = DealDetail["risks"][number];
export type CompanyFlagItem = DealDetail["flags"][number];
export type DebtCapacity = DealDetail["debt_capacity"];
