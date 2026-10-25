"use client";

import { Chart } from "@/components/charts/Chart";
import { stackedBarOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { ExitRouteMix } from "./types";

const pct = (v: number) => fmt.pct(v, { input: "percent", dp: 0 });

type Props = { mixes: ExitRouteMix[]; loading?: boolean; label?: string; description?: string };

export function ExitRoutesChart({ mixes, loading, label = "Exit routes by segment", description = "Likely buyer mix for exits in each segment" }: Props) {
  const theme = useChartTheme();
  const option = stackedBarOption(
    {
      categories: mixes.map((m) => m.segment.short),
      series: [
        { name: "Strategic", values: mixes.map((m) => m.strategic_pct) },
        { name: "Sponsor", values: mixes.map((m) => m.sponsor_pct) },
        { name: "IPO", values: mixes.map((m) => m.ipo_pct) },
      ],
      percent: true,
    },
    theme,
  );
  return (
    <Card description={description} testId="exit-routes-chart">
      <Chart
        label={label}
        option={option}
        loading={loading}
        table={{
          columns: [
            { key: "segment", header: "Segment", render: (m) => m.segment.short },
            { key: "strategic", header: "Strategic", align: "right", render: (m) => pct(m.strategic_pct) },
            { key: "sponsor", header: "Sponsor", align: "right", render: (m) => pct(m.sponsor_pct) },
            { key: "ipo", header: "IPO", align: "right", render: (m) => pct(m.ipo_pct) },
          ],
          rows: mixes,
          getRowId: (m) => m.id,
        }}
      />
    </Card>
  );
}
