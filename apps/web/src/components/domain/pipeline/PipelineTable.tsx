import { VERDICT_TONE } from "@/components/domain/verdict";
import { Badge, Card, type Column, DataTable, ScoreBar, SegmentedControl } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { Deal } from "./types";

export const VERDICT_FILTERS = ["All", "Advance", "Watch", "Pass"] as const;

type Props = {
  deals: Deal[];
  verdict: string;
  onVerdictChange: (verdict: string) => void;
  thresholds: { good: number; warn: number };
  onOpen: (deal: Deal) => void;
  isRecent?: (id: string) => boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

export function PipelineTable({ deals, verdict, onVerdictChange, thresholds, onOpen, isRecent, loading, error, onRetry }: Props) {
  const columns: Column<Deal>[] = [
    { key: "company", header: "Company", render: (d) => d.company.name, sub: (d) => `${d.code_name} · ${d.segment.short} · ${d.company.hq}`, sortValue: (d) => d.company.name },
    { key: "stage", header: "Stage", render: (d) => d.stage, sortValue: (d) => d.stage },
    { key: "ebitda", header: "EBITDA £m", align: "right", render: (d) => fmt.money(d.financials.ebitda, { style: "financial" }), sortValue: (d) => d.financials.ebitda },
    { key: "recurring", header: "Recurring", align: "right", render: (d) => fmt.pct(d.financials.recurring_pct, { dp: 0 }), sortValue: (d) => d.financials.recurring_pct },
    { key: "ask", header: "Ask", align: "right", render: (d) => fmt.multiple(d.ask_multiple), sortValue: (d) => d.ask_multiple },
    { key: "score", header: "Score", render: (d) => <ScoreBar value={d.screening.score} label="Score" thresholds={thresholds} />, sortValue: (d) => d.screening.score },
    { key: "verdict", header: "Verdict", render: (d) => <Badge tone={VERDICT_TONE[d.screening.verdict]}>{d.screening.verdict}</Badge>, sub: (d) => d.screening.gate_reason, sortValue: (d) => d.screening.verdict },
  ];

  return (
    <Card
      flush
      testId="pipeline-table"
      actions={
        <SegmentedControl
          label="Verdict"
          value={verdict}
          onChange={onVerdictChange}
          options={VERDICT_FILTERS.map((v) => ({ value: v, label: v }))}
        />
      }
    >
      <DataTable
        label="Deals"
        columns={columns}
        rows={deals}
        getRowId={(d) => d.id}
        onRowClick={onOpen}
        isRecent={isRecent}
        loading={loading}
        error={error}
        onRetry={onRetry}
        empty="No deals match this filter."
      />
    </Card>
  );
}
