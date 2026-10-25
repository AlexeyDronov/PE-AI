import { Badge, Card, type Column, DataTable } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { FundPoint } from "./types";

const money = (v: number) => fmt.money(v, { style: "financial" });

const COLUMNS: Column<FundPoint>[] = [
  {
    key: "period",
    header: "Year",
    render: (p) => (
      <>
        {p.period} {p.projected ? <Badge>Projected</Badge> : null}
      </>
    ),
    sortValue: (p) => p.period,
  },
  { key: "calls", header: "Calls", align: "right", render: (p) => money(p.calls) },
  { key: "distributions", header: "Distributions", align: "right", render: (p) => money(p.distributions) },
  { key: "nav", header: "NAV", align: "right", render: (p) => money(p.nav) },
  { key: "net", header: "Cumulative net", align: "right", render: (p) => money(p.cumulative_net) },
];

export function CashFlowTable({ series, loading, error, onRetry }: { series: FundPoint[]; loading?: boolean; error?: string; onRetry?: () => void }) {
  return (
    <Card flush testId="cash-flow-table">
      <DataTable label="Cash flows" columns={COLUMNS} rows={series} getRowId={(p) => p.period} loading={loading} error={error} onRetry={onRetry} empty="No cash flows yet." />
    </Card>
  );
}
