"use client";

import { Chart } from "@/components/charts/Chart";
import { lineOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { PlatformDetail } from "./types";

export function QuarterlyEbitda({ quarters, loading }: { quarters: PlatformDetail["quarters"]; loading?: boolean }) {
  const theme = useChartTheme();
  const option = lineOption(
    {
      categories: quarters.map((q) => fmt.quarter(q.period)),
      series: [
        { name: "EBITDA", values: quarters.map((q) => q.ebitda) },
        { name: "Budget", values: quarters.map((q) => q.ebitda_budget), role: "comparison" },
      ],
      valueFormat: fmt.money,
      unit: "money",
    },
    theme,
  );
  return (
    <Card title="Quarterly EBITDA vs budget" description="Actual earnings against plan, by quarter" testId="quarterly-ebitda">
      <Chart
        label="Quarterly EBITDA vs budget"
        option={option}
        loading={loading}
        table={{
          columns: [
            { key: "period", header: "Quarter", render: (q) => fmt.quarter(q.period) },
            { key: "ebitda", header: "EBITDA", align: "right", render: (q) => fmt.money(q.ebitda) },
            { key: "budget", header: "Budget", align: "right", render: (q) => fmt.money(q.ebitda_budget) },
          ],
          rows: quarters,
          getRowId: (q) => q.period,
        }}
      />
    </Card>
  );
}
