"use client";

import { CashFlowTable, DistributionWaterfall, JCurveChart } from "@/components/domain/fund";
import { PageHeader, PageSection, StatStrip } from "@/components/ui";
import { useResource } from "@/hooks/useResource";
import { fmt } from "@/lib/format";

export function FundView() {
  const funds = useResource("funds");
  const fund = funds.data?.items[0];
  const m = fund?.metrics;

  const stats =
    fund && m
      ? [
          { label: "Net IRR", value: fmt.pct(m.net_irr) },
          { label: "TVPI", value: fmt.multiple(m.tvpi, { dp: 2 }) },
          { label: "DPI", value: fmt.multiple(m.dpi, { dp: 2 }) },
          { label: "NAV", value: fmt.money(m.nav) },
          { label: "Called", value: fmt.money(m.called), hint: `${fmt.pct(m.called / fund.committed, { dp: 0 })} of ${fmt.money(fund.committed)}` },
        ]
      : [];

  return (
    <>
      <PageHeader
        title="Fund performance"
        description={fund ? `${fund.name}, ${fund.vintage} vintage, ${fmt.money(fund.committed)} committed · as of ${fmt.date(fund.as_of)}` : undefined}
      />

      <PageSection id="returns" title="Returns">
        <StatStrip items={stats} loading={!fund} count={5} />
      </PageSection>

      {fund && m ? (
        <>
          <PageSection id="j-curve" title="J-curve">
            <JCurveChart series={m.series} asOfPeriod={m.as_of_period} />
          </PageSection>
          <PageSection id="waterfall" title="Distribution waterfall">
            <DistributionWaterfall tiers={m.waterfall} prefRate={fund.pref_rate} carry={fund.carry} gpCarry={m.gp_carry} lpTotal={m.lp_total} />
          </PageSection>
          <PageSection id="cash-flows" title="Cash flows">
            <CashFlowTable series={m.series} />
          </PageSection>
        </>
      ) : null}
    </>
  );
}
