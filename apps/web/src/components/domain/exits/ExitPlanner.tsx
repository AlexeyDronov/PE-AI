import Link from "next/link";
import { platformTone } from "@/components/domain/platformStatus";
import { Badge, Card, type Column, DataTable } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { ExitPlan } from "./types";
import { windowStart } from "./window";

type Props = { plans: ExitPlan[]; loading?: boolean; error?: string; onRetry?: () => void };

const COLUMNS: Column<ExitPlan>[] = [
  { key: "company", header: "Company", render: (p) => <Link href={`/portfolio/${p.platform.id}`}>{p.company.name}</Link>, sortValue: (p) => p.company.name },
  { key: "route", header: "Route", render: (p) => p.route, sortValue: (p) => p.route },
  { key: "buyers", header: "Likely buyers", render: (p) => p.buyers },
  { key: "window", header: "Window", render: (p) => p.window, sortValue: (p) => windowStart(p.window), nowrap: true },
  { key: "moic", header: "Current MOIC", align: "right", render: (p) => fmt.multiple(p.platform.moic, { dp: 2 }), sortValue: (p) => p.platform.moic },
  { key: "fair_value", header: "Fair value", align: "right", render: (p) => fmt.money(p.platform.fair_value), sortValue: (p) => p.platform.fair_value },
  { key: "status", header: "Status", render: (p) => <Badge tone={platformTone(p.platform.status)}>{p.platform.status_label}</Badge>, sortValue: (p) => p.platform.status_label },
];

export function ExitPlanner({ plans, loading, error, onRetry }: Props) {
  const soonestFirst = [...plans].sort((a, b) => windowStart(a.window) - windowStart(b.window));
  return (
    <Card flush testId="exit-planner">
      <DataTable label="Exit planner" columns={COLUMNS} rows={soonestFirst} getRowId={(p) => p.id} loading={loading} error={error} onRetry={onRetry} empty="No exit plans yet." />
    </Card>
  );
}
