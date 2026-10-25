"use client";

import { CovenantTable, TestCalendar } from "@/components/domain/portfolio";
import { PageHeader, PageSection, Skeleton, StatStrip } from "@/components/ui";
import { useResource } from "@/hooks/useResource";
import { fmt } from "@/lib/format";

export function CovenantsView() {
  const facilities = useResource("debtFacilities");
  const summary = useResource("covenantSummary");

  const s = summary.data;
  const items = facilities.data?.items;
  const sorted = items ? [...items].sort((a, b) => a.headroom - b.headroom) : undefined;
  const stats = s
    ? [
        { label: "Facilities", value: fmt.int(s.facilities) },
        { label: "Tightest headroom", value: fmt.pct(s.tightest?.headroom), hint: s.tightest?.company },
        { label: "Below comfort", value: fmt.int(s.below_comfort), hint: `Under ${fmt.pct(s.comfort_threshold, { dp: 0 })} headroom` },
        { label: "Next test", value: fmt.date(s.next_test_date) },
      ]
    : [];
  const failed = facilities.isError || summary.isError;

  return (
    <>
      <PageHeader title="Covenants" description="Where lender risk is building across the portfolio." />

      <PageSection id="headroom-summary" title="Headroom summary">
        <StatStrip items={stats} loading={!s} />
      </PageSection>

      <PageSection id="covenant-monitor" title="Covenant monitor" description="Tightest headroom first">
        {sorted && s ? (
          <CovenantTable facilities={sorted} threshold={s.comfort_threshold} />
        ) : failed ? (
          <CovenantTable
            facilities={[]}
            threshold={0}
            error="Couldn't load covenants."
            onRetry={() => {
              void facilities.refetch();
              void summary.refetch();
            }}
          />
        ) : (
          <Skeleton height={240} />
        )}
      </PageSection>

      <PageSection id="test-calendar" title="Test calendar" description="Upcoming covenant tests by date">
        <TestCalendar facilities={sorted ?? []} />
      </PageSection>
    </>
  );
}
