"use client";

import { Chart } from "@/components/charts/Chart";
import { barOption, waterfallOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { ValueStep } from "./types";

type Props = {
  /** Start value, then the levers, then the end value. */
  steps: ValueStep[];
  description?: string;
  loading?: boolean;
};

const TOLERANCE = 0.05;

export function ValueCreationChart({ steps, description, loading }: Props) {
  const theme = useChartTheme();
  const start = steps[0];
  const end = steps[steps.length - 1];
  const levers = steps.slice(1, -1);
  const reconciles = start !== undefined && end !== undefined && Math.abs(start.value + levers.reduce((sum, l) => sum + l.value, 0) - end.value) <= TOLERANCE;
  const option = reconciles
    ? waterfallOption(
        { steps: steps.map((s, i) => ({ label: s.label, value: s.value, kind: i === 0 ? "start" : i === steps.length - 1 ? "end" : "delta" })), valueFormat: fmt.money, unit: "money" },
        theme,
      )
    : barOption({ categories: levers.map((l) => l.label), series: [{ name: "Value created", values: levers.map((l) => l.value) }], signed: true, valueFormat: fmt.money, unit: "money" }, theme);
  return (
    <Card description={description} testId="value-creation-chart">
      <Chart
        label="Value creation"
        option={option}
        loading={loading}
        table={{
          columns: [
            { key: "label", header: "Step", render: (s) => s.label },
            { key: "value", header: "£m", align: "right", render: (s) => fmt.money(s.value) },
          ],
          rows: steps,
          getRowId: (s) => s.label,
        }}
      />
    </Card>
  );
}
