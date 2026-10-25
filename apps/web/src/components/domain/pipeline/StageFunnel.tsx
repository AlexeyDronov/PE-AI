"use client";

import { Chart } from "@/components/charts/Chart";
import { barOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { Card } from "@/components/ui";
import type { PipelineSummary } from "./types";

type Props = { byStage: PipelineSummary["by_stage"]; loading?: boolean };

export function StageFunnel({ byStage, loading }: Props) {
  const theme = useChartTheme();
  const option = barOption(
    { categories: byStage.map((s) => s.stage), series: [{ name: "Deals", values: byStage.map((s) => s.count) }], orientation: "horizontal", valueFormat: String, integer: true },
    theme,
  );
  return (
    <Card title="Deals by stage" description="Where the pipeline sits today" testId="stage-funnel">
      <Chart
        label="Deals by stage"
        option={option}
        loading={loading}
        table={{
          columns: [
            { key: "stage", header: "Stage", render: (s) => s.stage },
            { key: "count", header: "Deals", align: "right", render: (s) => s.count },
          ],
          rows: byStage,
          getRowId: (s) => s.stage,
        }}
      />
    </Card>
  );
}
