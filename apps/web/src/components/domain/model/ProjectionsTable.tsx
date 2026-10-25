import { Card, type Column, DataTable } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { YearResult } from "./types";

type Line = { key: string; label: string; value: (y: YearResult) => string };

const money = (pick: (y: YearResult) => number) => (y: YearResult) => fmt.money(pick(y), { style: "financial" });

const LINES: Line[] = [
  { key: "revenue", label: "Revenue", value: money((y) => y.revenue) },
  { key: "ebitda", label: "EBITDA", value: money((y) => y.ebitda) },
  { key: "margin", label: "EBITDA margin", value: (y) => fmt.pct(y.margin) },
  { key: "interest", label: "Interest", value: money((y) => y.interest) },
  { key: "tax", label: "Tax", value: money((y) => y.tax) },
  { key: "capex", label: "Capex", value: money((y) => y.capex) },
  { key: "fcf", label: "Free cash flow", value: money((y) => y.free_cash_flow) },
  { key: "senior", label: "Senior debt (close)", value: money((y) => y.senior_close) },
];

export function ProjectionsTable({ schedule, loading }: { schedule: YearResult[]; loading?: boolean }) {
  const columns: Column<Line>[] = [
    { key: "label", header: "£m", render: (l) => l.label },
    ...schedule.map((y, i): Column<Line> => ({ key: `y${y.year}`, header: `Year ${y.year}`, align: "right", render: (l) => l.value(schedule[i] ?? y) })),
  ];
  return (
    <Card flush title="Cash flow and debt schedule" testId="projections-table">
      <DataTable label="Projections" columns={columns} rows={LINES} getRowId={(l) => l.key} loading={loading} />
    </Card>
  );
}
