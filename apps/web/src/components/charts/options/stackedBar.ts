import { fmt } from "@/lib/format";
import { baseOption, cartesianAxes, type ChartOption, type Orientation, seriesColor, type Unit, type ValueFormat } from "./base";
import type { ChartTheme } from "../theme";

export type StackedInput = {
  categories: string[];
  series: { name: string; values: number[] }[];
  percent?: boolean;
  orientation?: Orientation;
  valueFormat?: ValueFormat;
  unit?: Unit;
};

const percentFormat: ValueFormat = (v) => fmt.pct(v, { input: "percent", dp: 0 });

export function stackedBarOption({ categories, series, percent, orientation = "horizontal", valueFormat, unit }: StackedInput, theme: ChartTheme): ChartOption {
  const format = percent ? percentFormat : valueFormat;
  const totals = categories.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  return {
    ...baseOption(theme, { seriesCount: series.length, trigger: "axis", valueFormat: format }),
    ...cartesianAxes(theme, { categories, orientation, format, unit: percent ? undefined : unit, valueExtra: percent ? { max: 100 } : undefined }),
    series: series.map((s, index) => ({
      name: s.name,
      type: "bar" as const,
      stack: "total",
      barMaxWidth: 16,
      itemStyle: { color: seriesColor(theme, index), borderColor: theme.surface, borderWidth: 1 },
      data: percent ? s.values.map((v, i) => ((totals[i] ?? 0) === 0 ? 0 : (v / (totals[i] ?? 1)) * 100)) : s.values,
    })),
  } as ChartOption;
}
