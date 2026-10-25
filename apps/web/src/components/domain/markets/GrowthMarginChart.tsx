"use client";

import { Chart } from "@/components/charts/Chart";
import { scatterOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { Segment } from "./types";

type Props = { segments: Segment[]; onOpen: (segment: Segment) => void; loading?: boolean };

const pct = (v: number) => fmt.pct(v, { input: "percent", dp: 0 });

export function GrowthMarginChart({ segments, onOpen, loading }: Props) {
  const theme = useChartTheme();
  const option = scatterOption(
    {
      points: segments.map((s) => ({ name: s.short, x: s.cagr * 100, y: s.avg_margin * 100, size: s.market_size })),
      xLabel: "Market growth (CAGR)",
      yLabel: "Average EBITDA margin",
      xFormat: pct,
      yFormat: pct,
    },
    theme,
  );
  return (
    <Card description="Bubble size is market size. Select a segment to open it." testId="growth-margin-chart">
      <Chart
        label="Growth vs margin"
        option={option}
        loading={loading}
        onSelect={({ dataIndex }) => {
          const segment = segments[dataIndex];
          if (segment) onOpen(segment);
        }}
        table={{
          columns: [
            { key: "segment", header: "Segment", render: (s) => s.short },
            { key: "cagr", header: "CAGR", align: "right", render: (s) => fmt.pct(s.cagr) },
            { key: "margin", header: "Avg margin", align: "right", render: (s) => fmt.pct(s.avg_margin) },
            { key: "size", header: "Market size", align: "right", render: (s) => fmt.bn(s.market_size, { dp: 1 }) },
          ],
          rows: segments,
          getRowId: (s) => s.id,
        }}
      />
    </Card>
  );
}
