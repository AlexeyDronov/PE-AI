import { legiblePair, mix } from "../color";
import { baseOption, tooltipOption, categoryAxis, type ChartOption, type ValueFormat } from "./base";
import type { ChartTheme } from "../theme";

export type HeatmapInput = {
  xLabels: string[];
  yLabels: string[];
  /** values[row][column], rows follow yLabels. */
  values: number[][];
  midpoint: number;
  range: [number, number];
  format?: ValueFormat;
};

function scaleColor(theme: ChartTheme, value: number, midpoint: number, [lo, hi]: [number, number]): string {
  const { lo: cold, mid, hi: warm } = theme.diverging;
  if (value <= midpoint) return mix(cold, mid, midpoint === lo ? 1 : (value - lo) / (midpoint - lo));
  return mix(mid, warm, midpoint === hi ? 0 : (value - midpoint) / (hi - midpoint));
}

export function heatmapOption({ xLabels, yLabels, values, midpoint, range, format = String }: HeatmapInput, theme: ChartTheme): ChartOption {
  const cells = values.flatMap((row, y) =>
    row.map((value, x) => {
      const { fill: color, label } = legiblePair(scaleColor(theme, value, midpoint, range), [theme.ink, theme.surface]);
      return {
        value: [x, y, value],
        itemStyle: { color, borderColor: theme.surface, borderWidth: 2 },
        label: { show: true, color: label, formatter: format(value), fontFamily: theme.fontFamily },
      };
    }),
  );
  return {
    ...baseOption(theme, { seriesCount: 1 }),
    xAxis: { ...categoryAxis(theme, xLabels), axisLine: { show: false } },
    yAxis: { ...categoryAxis(theme, yLabels, { inverse: true }), axisLine: { show: false } },
    tooltip: {
      ...tooltipOption(theme),
      formatter: (p: unknown) => {
        const [x, y, v] = (p as { value: [number, number, number] }).value;
        return `${yLabels[y]} / ${xLabels[x]}: <b>${format(v)}</b>`;
      },
    },
    visualMap: {
      show: false,
      type: "continuous" as const,
      min: range[0],
      max: range[1],
      dimension: 2,
      inRange: { color: [theme.diverging.lo, theme.diverging.mid, theme.diverging.hi] },
    },
    series: [{ type: "heatmap" as const, data: cells }],
  } as ChartOption;
}
