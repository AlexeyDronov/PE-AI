"use client";

import { useRouter } from "next/navigation";
import { PipelineTable, SegmentScores, StageFunnel } from "@/components/domain/pipeline";
import { ButtonLink, PageHeader, PageSection, StatStrip } from "@/components/ui";
import { useIsRecent } from "@/hooks/useLiveEvents";
import { useResource } from "@/hooks/useResource";
import { useUrlState } from "@/hooks/useUrlState";
import { fmt } from "@/lib/format";
import styles from "./PipelineView.module.css";

export function PipelineView() {
  const router = useRouter();
  const [verdict, setVerdict] = useUrlState("verdict", "All");
  const summary = useResource("pipelineSummary");
  const deals = useResource("deals", verdict === "All" ? { sort: "-score" } : { sort: "-score", verdict: verdict as "Advance" | "Watch" | "Pass" }, { keepPrevious: true });
  const funds = useResource("funds");
  const isRecent = useIsRecent();

  const fund = funds.data?.items[0];
  const s = summary.data;
  const stats = s
    ? [
        { label: "Deals", value: fmt.int(s.total) },
        { label: "Advance", value: fmt.int(s.counts.Advance ?? 0) },
        { label: "Watch", value: fmt.int(s.counts.Watch ?? 0) },
        { label: "Average score", value: fmt.int(s.average_score) },
        { label: "Median ask", value: fmt.multiple(s.median_ask) },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Opportunities scored against the fund's buyout criteria."
        meta={
          fund ? (
            <span className={styles.mandate}>
              EBITDA £{fmt.int(fund.ebitda_min)}–{fmt.int(fund.ebitda_max)}m · hurdle {fmt.pct(fund.irr_hurdle, { dp: 0 })} IRR · max leverage {fmt.multiple(fund.max_leverage)}
            </span>
          ) : null
        }
        actions={
          <ButtonLink href="/deals/new" variant="primary">
            Screen a teaser
          </ButtonLink>
        }
      />

      <PageSection id="summary" title="Summary">
        <StatStrip items={stats} loading={!s} count={5} />
      </PageSection>

      <PageSection id="deals" title="Deals" description="Select a deal to open its overview, model and IC memo">
        <PipelineTable
          deals={deals.data?.items ?? []}
          verdict={verdict}
          onVerdictChange={setVerdict}
          thresholds={{ good: fund?.verdict_advance ?? 0, warn: fund?.verdict_watch ?? 0 }}
          onOpen={(deal) => router.push(`/deals/${deal.id}`)}
          isRecent={isRecent}
          loading={deals.isPending || funds.isPending}
          error={deals.isError || funds.isError ? "Couldn't load deals." : undefined}
          onRetry={() => {
            void deals.refetch();
            void funds.refetch();
          }}
        />
      </PageSection>

      <PageSection id="flow" title="Flow">
        <div className={styles.flow}>
          <StageFunnel byStage={s?.by_stage ?? []} loading={!s} />
          <SegmentScores bySegment={s?.by_segment ?? []} loading={!s} />
        </div>
      </PageSection>
    </>
  );
}
