"use client";

import { ActivityFeed, AttentionAlerts, AwaitingDecision } from "@/components/domain/overview";
import { PageHeader, PageSection, StatStrip } from "@/components/ui";
import { useResource } from "@/hooks/useResource";
import { fmt } from "@/lib/format";
import styles from "./Overview.module.css";

export function OverviewView() {
  const summary = useResource("overviewSummary");
  const alerts = useResource("alerts");
  const deals = useResource("deals", { verdict: "Advance", sort: "-score" });
  const funds = useResource("funds");
  const jobs = useResource("jobs", { sort: "-updated_at", limit: 8 });

  const s = summary.data;
  const fund = funds.data?.items[0];
  const stats = s
    ? [
        { label: "NAV", value: fmt.money(s.nav) },
        { label: "Net IRR", value: fmt.pct(s.net_irr) },
        { label: "TVPI", value: fmt.multiple(s.tvpi, { dp: 2 }) },
        { label: "DPI", value: fmt.multiple(s.dpi, { dp: 2 }) },
        { label: "Dry powder", value: fmt.money(s.dry_powder) },
        { label: "In diligence", value: fmt.int(s.in_diligence), hint: `of ${fmt.int(s.pipeline_total)} in pipeline` },
      ]
    : [];

  return (
    <>
      <PageHeader title="Overview" description="What needs your attention today." />

      <PageSection id="glance" title="Fund at a glance">
        <StatStrip items={stats} loading={!s} count={6} />
      </PageSection>

      <PageSection id="attention" title="Needs attention">
        <div className={styles.attention}>
          <AttentionAlerts alerts={alerts.data?.items ?? []} loading={alerts.isPending} />
          <AwaitingDecision
            deals={deals.data?.items ?? []}
            thresholds={{ good: fund?.verdict_advance ?? 0, warn: fund?.verdict_watch ?? 0 }}
            loading={deals.isPending || funds.isPending}
          />
        </div>
      </PageSection>

      <PageSection id="activity" title="Copilot activity" description="Running and recent jobs, updated live">
        <ActivityFeed jobs={jobs.data?.items ?? []} loading={jobs.isPending} />
      </PageSection>
    </>
  );
}
