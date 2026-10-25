import { alpha } from "../color";
import { baseOption, cartesianAxes, type ChartOption, type Role, seriesColor, type Unit, type ValueFormat } from "./base";
import type { ChartTheme } from "../theme";

export type LineSeries = { name: string; values: number[]; role?: Role; area?: boolean };
export type LineInput = { categories: string[]; series: LineSeries[]; zeroLine?: boolean; /** Index of the first projected category; shades from there to the end. */ projectedFrom?: number; valueFormat?: ValueFormat; unit?: Unit };

export function lineOption({ categories, series, zeroLine, projectedFrom, valueFormat, unit }: LineInput, theme: ChartTheme): ChartOption {
  return {
    ...baseOption(theme, { seriesCount: series.length, trigger: "axis", valueFormat }),
    ...cartesianAxes(theme, { categories, orientation: "vertical", format: valueFormat, unit }),
    series: series.map((s, index) => {
      const color = seriesColor(theme, index, s.role);
      return {
        name: s.name,
        type: "line" as const,
        data: s.values,
        symbol: "circle",
        symbolSize: 8,
        lineStyle: { width: 2, color },
        itemStyle: { color, borderColor: theme.surface, borderWidth: 2 },
        ...(s.area
          ? {
              areaStyle: {
                color: {
                  type: "linear" as const,
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: alpha(color, 0.24) },
                    { offset: 1, color: alpha(color, 0) },
                  ],
                },
              },
            }
          : {}),
        ...(projectedFrom !== undefined && index === 0 && categories[projectedFrom] !== undefined
          ? { markArea: { silent: true, itemStyle: { color: alpha(theme.ink3, 0.1) }, data: [[{ xAxis: categories[projectedFrom] }, { xAxis: categories[categories.length - 1] }]] } }
          : {}),
        ...(zeroLine && index === 0
          ? { markLine: { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: theme.ink3, type: "dashed" as const, width: 1 }, data: [{ yAxis: 0 }] } }
          : {}),
      };
    }),
  } as ChartOption;
}
