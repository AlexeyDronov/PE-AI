import { barStyle, baseOption, CATEGORY_LABELS, cartesianAxes, type ChartOption, type Orientation, type Role, seriesColor, type Unit, type ValueFormat } from "./base";
import type { ChartTheme } from "../theme";

export type BarSeries = { name: string; values: number[]; role?: Role; mark?: "bar" | "marker" };
export type BarInput = { categories: string[]; series: BarSeries[]; orientation?: Orientation; valueFormat?: ValueFormat; unit?: Unit; integer?: boolean };

export function barOption({ categories, series, orientation = "vertical", valueFormat, unit, integer }: BarInput, theme: ChartTheme): ChartOption {
  const horizontal = orientation === "horizontal";
  const style = barStyle(orientation);
  return {
    ...baseOption(theme, { seriesCount: series.length, trigger: "axis", valueFormat }),
    ...cartesianAxes(theme, { categories, orientation, format: valueFormat, unit, valueExtra: integer ? { minInterval: 1 } : undefined, categoryLabel: horizontal ? undefined : CATEGORY_LABELS }),
    series: series.map((s, index) => {
      const color = seriesColor(theme, index, s.role);
      if (s.mark === "marker") {
        return {
          name: s.name,
          type: "scatter" as const,
          symbol: "rect",
          symbolSize: horizontal ? [2, 20] : [20, 2],
          itemStyle: { color },
          z: 3,
          data: s.values.map((v, i) => (horizontal ? [v, categories[i]] : [categories[i], v])),
        };
      }
      return {
        name: s.name,
        type: "bar" as const,
        barMaxWidth: style.barMaxWidth,
        barGap: style.barGap,
        itemStyle: { color, borderRadius: style.radius },
        data: s.values,
      };
    }),
  } as ChartOption;
}
