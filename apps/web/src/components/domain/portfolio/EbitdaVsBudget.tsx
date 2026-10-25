"use client";

import { Chart } from "@/components/charts/Chart";
import { barOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { Platform } from "./types";

export function EbitdaVsBudget({ platforms, loading }: { platforms: Platform[]; loading?: boolean }) {
  const theme = useChartTheme();
  const option = barOption(
    {
      categories: platforms.map((p) => p.company.name),
      series: [
        { name: "LTM EBITDA", values: platforms.map((p) => p.ebitda_ltm) },
        { name: "Budget", values: platforms.map((p) => p.ebitda_budget), role: "comparison", mark: "marker" },
      ],
      orientation: "horizontal",
      valueFormat: fmt.money,
      unit: "money",
    },
    theme,
  );
  return (
    <Card title="LTM EBITDA vs budget" description="Actual earnings against plan, by platform" testId="ebitda-vs-budget">
      <Chart
        label="LTM EBITDA vs budget"
        option={option}
        loading={loading}
        table={{
          columns: [
            { key: "company", header: "Company", render: (p) => p.company.name },
            { key: "actual", header: "LTM EBITDA", align: "right", render: (p) => fmt.money(p.ebitda_ltm) },
            { key: "budget", header: "Budget", align: "right", render: (p) => fmt.money(p.ebitda_budget) },
          ],
          rows: platforms,
          getRowId: (p) => p.id,
        }}
      />
    </Card>
  );
}
