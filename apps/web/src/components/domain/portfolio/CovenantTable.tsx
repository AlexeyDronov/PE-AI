import { Badge, Card, type Column, DataTable, HeadroomMeter } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { Facility } from "./types";

type Props = { facilities: Facility[]; threshold: number; loading?: boolean; error?: string; onRetry?: () => void };

export function CovenantTable({ facilities, threshold, loading, error, onRetry }: Props) {
  const columns: Column<Facility>[] = [
    { key: "company", header: "Company", render: (f) => f.company.name, sortValue: (f) => f.company.name },
    { key: "type", nowrap: true, header: "Facility", render: (f) => f.type, sortValue: (f) => f.type },
    { key: "pricing", nowrap: true, header: "Pricing", render: (f) => f.pricing },
    { key: "covenant", header: "Covenant", render: (f) => f.covenant },
    { key: "test", nowrap: true, header: "Test", align: "right", render: (f) => fmt.multiple(f.test_level), sortValue: (f) => f.test_level },
    { key: "actual", nowrap: true, header: "Actual", align: "right", render: (f) => fmt.multiple(f.actual), sortValue: (f) => f.actual },
    { key: "headroom", header: "Headroom", render: (f) => <HeadroomMeter label="Covenant headroom" value={f.headroom} threshold={threshold} />, sortValue: (f) => f.headroom },
    { key: "cover", header: "Interest cover", align: "right", render: (f) => fmt.multiple(f.interest_cover), sortValue: (f) => f.interest_cover },
    { key: "covlite", header: "Cov-lite", render: (f) => (f.cov_lite ? <Badge tone="accent">Cov-lite</Badge> : null) },
  ];
  return (
    <Card flush testId="covenant-table">
      <DataTable label="Covenant monitor" columns={columns} rows={facilities} getRowId={(f) => f.id} loading={loading} error={error} onRetry={onRetry} empty="No facilities." />
    </Card>
  );
}
