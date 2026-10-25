import { Card, type Column, DataTable, ScoreBar } from "@/components/ui";
import { criterionValue } from "./criteria";
import type { Criterion } from "./types";

type Props = {
  criteria: Criterion[];
  thresholds: { good: number; warn: number };
  loading?: boolean;
};

export function Scorecard({ criteria, thresholds, loading }: Props) {
  const columns: Column<Criterion>[] = [
    { key: "criterion", header: "Criterion", render: (c) => c.label },
    { key: "value", header: "Value", align: "right", render: (c) => criterionValue(c.key, c.value) },
    { key: "target", header: "Target", render: (c) => c.target_text },
    { key: "score", header: "Score", render: (c) => <ScoreBar value={Math.round(c.score)} label={c.label} thresholds={thresholds} /> },
  ];
  return (
    <Card flush testId="scorecard">
      <DataTable label="Scorecard" columns={columns} rows={criteria} getRowId={(c) => c.key} loading={loading} />
    </Card>
  );
}
