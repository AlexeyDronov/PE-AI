"use client";

import { Chart } from "@/components/charts/Chart";
import { lineOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { FundPoint } from "./types";

type Props = { series: FundPoint[]; asOfPeriod?: string; loading?: boolean };

export function JCurveChart({ series, asOfPeriod, loading }: Props) {
  const theme = useChartTheme();
  const first = series.findIndex((p) => p.projected);
  const option = lineOption(
    {
      categories: series.map((p) => p.period),
      series: [
        { name: "Cumulative net cash flow", values: series.map((p) => p.cumulative_net), area: true },
        { name: "NAV", values: series.map((p) => p.nav), role: "comparison" },
      ],
      zeroLine: true,
      projectedFrom: first >= 0 ? first : undefined,
      valueFormat: fmt.money,
      unit: "money",
    },
    theme,
  );
  return (
    <Card description={first >= 0 && asOfPeriod ? `Projected after ${asOfPeriod}` : undefined} testId="j-curve">
      <Chart
        label="Fund J-curve"
        option={option}
        loading={loading}
        table={{
          columns: [
            { key: "period", header: "Year", render: (p) => p.period },
            { key: "net", header: "Cumulative net", align: "right", render: (p) => fmt.money(p.cumulative_net) },
            { key: "nav", header: "NAV", align: "right", render: (p) => fmt.money(p.nav) },
          ],
          rows: series,
          getRowId: (p) => p.period,
        }}
      />
    </Card>
  );
}
