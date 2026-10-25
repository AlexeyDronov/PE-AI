"use client";

import { CompanyFlags, DebtCapacityPanel, DiligenceList, RiskChecks, Scorecard } from "@/components/domain/deal";
import { ErrorState, OnThisPage, PageSection, StatStrip } from "@/components/ui";
import { useResource } from "@/hooks/useResource";
import { fmt } from "@/lib/format";
import styles from "./DealOverview.module.css";

const SECTIONS = [
  { id: "snapshot", label: "Snapshot" },
  { id: "scorecard", label: "Scorecard" },
  { id: "risks", label: "Risks" },
  { id: "debt-capacity", label: "Debt capacity" },
  { id: "diligence-questions", label: "Diligence questions" },
];

export function DealOverview({ dealId }: { dealId: string }) {
  const deal = useResource("deal", { id: dealId });
  const funds = useResource("funds");

  if (deal.isError) return <ErrorState message="Couldn't load this deal." onRetry={() => void deal.refetch()} />;

  const data = deal.data;
  const fund = funds.data?.items[0];
  const margin = data?.screening.criteria.find((c) => c.key === "margin");
  const stats = data
    ? [
        { label: "Score", value: fmt.int(data.screening.score), hint: data.screening.verdict },
        { label: "LTM EBITDA", value: fmt.money(data.financials.ebitda), hint: margin ? `${fmt.pct(margin.value)} margin` : undefined },
        { label: "Revenue growth", value: fmt.pct(data.financials.growth) },
        { label: "Recurring", value: fmt.pct(data.financials.recurring_pct) },
        { label: "Ask", value: fmt.multiple(data.ask_multiple), hint: `Segment median ${fmt.multiple(data.segment.median_multiple)}` },
      ]
    : [];

  return (
    <div className={styles.layout} data-testid="deal-overview">
      <div className={styles.sections}>
        <PageSection id="snapshot" title="Snapshot">
          <StatStrip items={stats} loading={!data} count={5} />
          {data ? <p className={styles.prose}>{data.company.description}</p> : null}
        </PageSection>

        <PageSection id="scorecard" title="Scorecard" description="Each criterion against the fund's target">
          <Scorecard
            criteria={data?.screening.criteria ?? []}
            thresholds={{ good: fund?.verdict_advance ?? 0, warn: fund?.verdict_watch ?? 0 }}
            loading={!data}
          />
        </PageSection>

        <PageSection id="risks" title="Risks" description="Standard checks and flags specific to this company">
          <div className={styles.pair}>
            <RiskChecks checks={data?.risks ?? []} loading={!data} />
            <CompanyFlags flags={data?.flags ?? []} loading={!data} />
          </div>
        </PageSection>

        <PageSection id="debt-capacity" title="Debt capacity" description="What the business can carry at fund policy and under stress">
          <DebtCapacityPanel capacity={data?.debt_capacity} loading={!data} />
        </PageSection>

        <PageSection id="diligence-questions" title="Diligence questions">
          <DiligenceList questions={data?.questions ?? []} loading={!data} />
        </PageSection>
      </div>
      <OnThisPage items={SECTIONS} />
    </div>
  );
}
