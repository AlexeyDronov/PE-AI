import { Badge, type Column, DataTable, type Tone } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { Finding } from "./types";

const CONFIDENCE_TONE: Record<string, Tone> = { low: "warn", medium: "neutral", high: "good" };

const COLUMNS: Column<Finding>[] = [
  { key: "metric", header: "Metric", render: (f) => f.metric },
  { key: "value", header: "Value", align: "right", nowrap: true, render: (f) => `${fmt.num(f.value)}${f.unit ? ` ${f.unit}` : ""}` },
  { key: "period", header: "Period", nowrap: true, render: (f) => f.period ?? "–" },
  { key: "confidence", header: "Confidence", render: (f) => <Badge tone={CONFIDENCE_TONE[f.confidence] ?? "neutral"}>{f.confidence}</Badge> },
  { key: "refs", header: "Sources", nowrap: true, render: (f) => (f.refs.length ? `[${f.refs.join(", ")}]` : "–") },
];

export function FindingsTable({ findings }: { findings: Finding[] }) {
  return <DataTable label="Findings" columns={COLUMNS} rows={findings} getRowId={(f) => f.id} empty="No findings were extracted." testId="findings-table" />;
}
