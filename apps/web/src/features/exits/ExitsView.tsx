"use client";

import { ExitPlanner, ExitRoutesChart } from "@/components/domain/exits";
import { PageHeader, PageSection, StatStrip } from "@/components/ui";
import { useResource } from "@/hooks/useResource";
import { fmt } from "@/lib/format";

export function ExitsView() {
  const plans = useResource("exitPlans");
  const summary = useResource("exitSummary");
  const mixes = useResource("exitRouteMixes");

  const s = summary.data;
  const stats = s
    ? [
        { label: "Platforms", value: fmt.int(s.platforms), hint: Object.entries(s.routes).map(([route, n]) => `${route} ${n}`).join(" · ") },
        { label: "In exit prep", value: fmt.int(s.exit_prep) },
        { label: "Exit-prep fair value", value: fmt.money(s.exit_prep_fair_value) },
      ]
    : [];

  return (
    <>
      <PageHeader title="Exits" description="What to sell, when, and to whom." />

      <PageSection id="readiness" title="Readiness">
        <StatStrip items={stats} loading={!s} count={3} />
      </PageSection>

      <PageSection id="planner" title="Exit planner" description="Route, likely buyers and window for each platform">
        <ExitPlanner plans={plans.data?.items ?? []} loading={plans.isPending} error={plans.isError ? "Couldn't load exit plans." : undefined} onRetry={() => void plans.refetch()} />
      </PageSection>

      <PageSection id="routes" title="Exit routes by segment">
        <ExitRoutesChart mixes={mixes.data?.items ?? []} loading={mixes.isPending} />
      </PageSection>
    </>
  );
}
