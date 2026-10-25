"use client";

import { Chart } from "@/components/charts/Chart";
import { barOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { Segment } from "./types";

export function MultipleArbitrageChart({ segments, loading }: { segments: Segment[]; loading?: boolean }) {
  const theme = useChartTheme();
  const option = barOption(
    {
      categories: segments.map((s) => s.short),
      series: [
        { name: "Platform median", values: segments.map((s) => s.median_multiple) },
        { name: "Add-on multiple", values: segments.map((s) => s.addon_multiple), role: "comparison" },
      ],
      valueFormat: (v) => fmt.multiple(v),
    },
    theme,
  );
  return (
    <Card description="Buy add-ons cheaper than the platform multiple" testId="multiple-arbitrage-chart">
      <Chart
        label="Roll-up multiple arbitrage"
        option={option}
        loading={loading}
        table={{
          columns: [
            { key: "segment", header: "Segment", render: (s) => s.short },
            { key: "platform", header: "Platform median", align: "right", render: (s) => fmt.multiple(s.median_multiple) },
            { key: "addon", header: "Add-on", align: "right", render: (s) => fmt.multiple(s.addon_multiple) },
          ],
          rows: segments,
          getRowId: (s) => s.id,
        }}
      />
    </Card>
  );
}
