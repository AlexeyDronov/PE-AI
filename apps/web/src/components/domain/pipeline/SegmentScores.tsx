"use client";

import { Chart } from "@/components/charts/Chart";
import { barOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { PipelineSummary } from "./types";

type Props = { bySegment: PipelineSummary["by_segment"]; loading?: boolean };

export function SegmentScores({ bySegment, loading }: Props) {
  const theme = useChartTheme();
  const option = barOption(
    {
      categories: bySegment.map((s) => s.short),
      series: [
        { name: "Average score", values: bySegment.map((s) => s.average_score) },
        { name: "Best score", values: bySegment.map((s) => s.best_score), role: "comparison", mark: "marker" },
      ],
      valueFormat: fmt.int,
    },
    theme,
  );
  return (
    <Card title="Score by segment" description="Average score, with the best deal marked" testId="segment-scores">
      <Chart
        label="Average score by segment"
        option={option}
        loading={loading}
        table={{
          columns: [
            { key: "segment", header: "Segment", render: (s) => s.short },
            { key: "count", header: "Deals", align: "right", render: (s) => s.count },
            { key: "average", header: "Average", align: "right", render: (s) => fmt.int(s.average_score) },
            { key: "best", header: "Best", align: "right", render: (s) => fmt.int(s.best_score) },
          ],
          rows: bySegment,
          getRowId: (s) => s.segment_id,
        }}
      />
    </Card>
  );
}
