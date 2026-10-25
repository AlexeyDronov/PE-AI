import { Card, KeyValueList, Skeleton } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { LboAssumptions, SourcesUses } from "./types";

const f = (v: number) => fmt.money(v, { style: "financial" });

export function SourcesUsesCard({ sourcesUses: s, assumptions: a }: { sourcesUses?: SourcesUses; assumptions?: LboAssumptions }) {
  return (
    <Card title="Sources and uses" description="£m" testId="sources-uses">
      {!s || !a ? (
        <Skeleton height={240} />
      ) : (
        <KeyValueList
          items={[
            { label: `Enterprise value (${fmt.multiple(a.entry_multiple)})`, value: f(s.enterprise_value) },
            { label: `Transaction fees (${fmt.pct(a.tx_fee_pct)})`, value: f(s.transaction_fees) },
            { label: `Financing fees (${fmt.pct(a.fin_fee_pct)})`, value: f(s.financing_fees) },
            { label: "Minimum cash", value: f(s.min_cash) },
            { label: "Total uses", value: f(s.total_uses), emphasis: true },
            { label: "Senior debt", value: f(s.senior_debt) },
            { label: "Subordinated debt", value: f(s.sub_debt) },
            { label: "Management rollover", value: f(s.rollover_equity) },
            { label: "Sponsor equity", value: f(s.sponsor_equity) },
            { label: "Total sources", value: f(s.total_sources), emphasis: true },
          ]}
        />
      )}
    </Card>
  );
}
