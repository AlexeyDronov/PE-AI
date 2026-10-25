"use client";

import { useRouter } from "next/navigation";
import { AttractivenessTable, GrowthMarginChart, MultipleArbitrageChart, SegmentShortlist } from "@/components/domain/markets";
import { ExitRoutesChart } from "@/components/domain/exits";
import { PageHeader, PageSection, StatStrip } from "@/components/ui";
import { useResource } from "@/hooks/useResource";
import { fmt } from "@/lib/format";
import styles from "./Markets.module.css";

export function MarketsView() {
  const router = useRouter();
  const segments = useResource("segments", { sort: "-attractiveness" });
  const summary = useResource("marketSummary");
  const mixes = useResource("exitRouteMixes");

  const items = segments.data?.items ?? [];
  const s = summary.data;
  const stats = s
    ? [
        { label: "Segments", value: fmt.int(s.segments) },
        { label: "Profit pool", value: fmt.bn(s.profit_pool) },
        { label: "Median EV/EBITDA", value: fmt.multiple(s.median_multiple) },
        { label: "Deals in 24m", value: fmt.int(s.deals_24m) },
      ]
    : [];

  return (
    <>
      <PageHeader title="Markets" description="Which sub-sectors deserve our time?" />

      <PageSection id="summary" title="Summary">
        <StatStrip items={stats} loading={!s} count={4} />
      </PageSection>

      <PageSection id="growth" title="Growth vs margin">
        <div className={styles.growth}>
          <GrowthMarginChart segments={items} loading={segments.isPending} onOpen={(segment) => router.push(`/markets/${segment.id}`)} />
          <SegmentShortlist segments={items} loading={segments.isPending} />
        </div>
      </PageSection>

      <PageSection id="attractiveness" title="Sponsor attractiveness" description="Each attribute scored 0 to 3">
        <AttractivenessTable
          segments={items}
          loading={segments.isPending}
          error={segments.isError ? "Couldn't load segments." : undefined}
          onRetry={() => void segments.refetch()}
        />
      </PageSection>

      <PageSection id="valuation" title="Valuation">
        <div className={styles.pair}>
          <MultipleArbitrageChart segments={items} loading={segments.isPending} />
          <ExitRoutesChart mixes={mixes.data?.items ?? []} loading={mixes.isPending} label="Exit routes, last 24 months" description="Buyer mix for recent exits in each segment" />
        </div>
      </PageSection>
    </>
  );
}
