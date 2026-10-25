import Link from "next/link";
import { Card, type Column, DataTable, DotRating } from "@/components/ui";
import type { Segment } from "./types";

const MAX_SCORE = 3;

type Props = { segments: Segment[]; loading?: boolean; error?: string; onRetry?: () => void };

export function AttractivenessTable({ segments, loading, error, onRetry }: Props) {
  const attributes = segments[0]?.attributes.map((a) => a.attribute) ?? [];
  const columns: Column<Segment>[] = [
    { key: "segment", header: "Segment", render: (s) => <Link href={`/markets/${s.id}`}>{s.short}</Link>, sortValue: (s) => s.short },
    ...attributes.map((attribute) => ({
      key: attribute,
      header: attribute,
      render: (s: Segment) => <DotRating value={s.attributes.find((a) => a.attribute === attribute)?.score ?? 0} max={MAX_SCORE} label={attribute} />,
      sortValue: (s: Segment) => s.attributes.find((a) => a.attribute === attribute)?.score ?? 0,
    })),
    { key: "total", header: "Total", align: "right", nowrap: true, render: (s) => `${s.attractiveness} / ${s.attractiveness_max}`, sortValue: (s) => s.attractiveness },
  ];
  return (
    <Card flush testId="attractiveness-table">
      <DataTable label="Sponsor attractiveness" columns={columns} rows={segments} getRowId={(s) => s.id} loading={loading} error={error} onRetry={onRetry} empty="No segments yet." />
    </Card>
  );
}
