import { platformTone } from "@/components/domain/platformStatus";
import { Badge, Card, type Column, DataTable } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./PlatformsTable.module.css";
import type { Platform } from "./types";

type Props = {
  platforms: Platform[];
  onOpen: (platform: Platform) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

const COLUMNS: Column<Platform>[] = [
  { key: "company", header: "Company", render: (p) => p.company.name, sub: (p) => p.segment.short, sortValue: (p) => p.company.name },
  { key: "year", header: "Year", align: "right", render: (p) => String(p.invest_year), sortValue: (p) => p.invest_year },
  { key: "invested", header: "Invested", align: "right", render: (p) => fmt.money(p.invested), sortValue: (p) => p.invested },
  { key: "fair_value", header: "Fair value", align: "right", render: (p) => fmt.money(p.fair_value), sortValue: (p) => p.fair_value },
  { key: "moic", header: "MOIC", align: "right", render: (p) => fmt.multiple(p.moic, { dp: 2 }), sortValue: (p) => p.moic },
  { key: "ebitda", header: "LTM EBITDA", align: "right", render: (p) => fmt.money(p.ebitda_ltm), sortValue: (p) => p.ebitda_ltm },
  {
    key: "variance",
    header: "vs budget",
    align: "right",
    render: (p) => (
      <span className={styles.variance} data-tone={p.budget_variance >= 0 ? "good" : "bad"}>
        {fmt.pct(p.budget_variance, { signed: true })}
      </span>
    ),
    sortValue: (p) => p.budget_variance,
  },
  { key: "leverage", header: "Leverage", align: "right", render: (p) => fmt.multiple(p.net_leverage), sortValue: (p) => p.net_leverage },
  { key: "status", header: "Status", render: (p) => <Badge tone={platformTone(p.status)}>{p.status_label}</Badge>, sortValue: (p) => p.status_label },
];

export function PlatformsTable({ platforms, onOpen, loading, error, onRetry }: Props) {
  return (
    <Card flush testId="platforms-table">
      <DataTable
        label="Platforms"
        columns={COLUMNS}
        rows={platforms}
        getRowId={(p) => p.id}
        onRowClick={onOpen}
        loading={loading}
        error={error}
        onRetry={onRetry}
        empty="No platforms yet."
      />
    </Card>
  );
}
