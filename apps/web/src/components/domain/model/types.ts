import type { CommandInput, ResourceData } from "@/lib/api/types";

export type LboResult = ResourceData<"lbo">;
export type LboAssumptions = LboResult["assumptions"];
export type SourcesUses = LboResult["sources_uses"];
export type YearResult = LboResult["schedule"][number];
export type CreditStats = LboResult["credit"];
export type Benchmark = ResourceData<"benchmarks">["items"][number];
export type Scenario = ResourceData<"lboScenarios">["items"][number];
export type Overrides = CommandInput<"saveScenario">["overrides"];
export type LboCase = CommandInput<"saveScenario">["case"];
