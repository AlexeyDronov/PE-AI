import { fmt } from "@/lib/format";
import { baseOption, tooltipOption, barStyle, cartesianAxes, type ChartOption, type Unit, type ValueFormat } from "./base";
import type { ChartTheme } from "../theme";

export type RangeRow = { label: string; low: number; high: number; marker?: number };
export type RangeInput = { rows: RangeRow[]; valueFormat?: ValueFormat; unit?: Unit };

/** Football-field chart: a floating bar from low to high with an optional marker tick. */
export function rangeBarOption({ rows, valueFormat = fmt.money, unit }: RangeInput, theme: ChartTheme): ChartOption {
  const labels = rows.map((r) => r.label);
  const style = barStyle("horizontal");
  const markers = rows.flatMap((r) => (r.marker === undefined ? [] : [[r.marker, r.label]]));
  const bar = (name: string, data: number[], itemStyle: Record<string, unknown>, silent = false) => ({
    name,
    type: "bar" as const,
    stack: "range",
    barMaxWidth: style.barMaxWidth,
    silent,
    itemStyle,
    data,
  });
  return {
    ...baseOption(theme, { seriesCount: 1 }),
    ...cartesianAxes(theme, { categories: labels, orientation: "horizontal", format: valueFormat, unit, valueExtra: { scale: true, splitNumber: 4 } }),
    tooltip: {
      ...tooltipOption(theme),
      formatter: (p: unknown) => {
        const row = rows[(p as { dataIndex: number }).dataIndex];
        if (!row) return "";
        const marker = row.marker === undefined ? "" : `<br/>Marker: ${valueFormat(row.marker)}`;
        return `<b>${row.label}</b><br/>${valueFormat(row.low)} to ${valueFormat(row.high)}${marker}`;
      },
    },
    series: [
      bar("base", rows.map((r) => r.low), { color: "transparent" }, true),
      bar("range", rows.map((r) => r.high - r.low), { color: theme.series[0], borderRadius: 3 }),
      ...(markers.length
        ? [{ name: "marker", type: "scatter" as const, symbol: "rect", symbolSize: [2, 24], itemStyle: { color: theme.ink }, z: 3, data: markers }]
        : []),
    ],
  } as ChartOption;
}
