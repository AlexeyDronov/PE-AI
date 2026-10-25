import { barStyle, baseOption, categoryLabels, cartesianAxes, compactMoney, type ChartOption, type Unit, type ValueFormat } from "./base";
import type { ChartTheme } from "../theme";

export type WaterfallStep = { label: string; value?: number; kind: "start" | "delta" | "end" };
export type WaterfallInput = { steps: WaterfallStep[]; valueFormat?: ValueFormat; unit?: Unit };

type Cell = number | "-";

export function waterfallOption({ steps, valueFormat, unit }: WaterfallInput, theme: ChartTheme): ChartOption {
  const base: Cell[] = [];
  const total: Cell[] = [];
  const increase: Cell[] = [];
  const decrease: Cell[] = [];
  let running = 0;
  for (const step of steps) {
    const delta = step.value ?? 0;
    if (step.kind === "delta") {
      base.push(delta >= 0 ? running : running + delta);
      total.push("-");
      increase.push(delta >= 0 ? delta : "-");
      decrease.push(delta < 0 ? -delta : "-");
      running += delta;
    } else {
      if (step.kind === "start") running = delta;
      base.push(0);
      total.push(running);
      increase.push("-");
      decrease.push("-");
    }
  }
  const style = barStyle("vertical");
  const totalFormat = unit === "money" ? compactMoney : (valueFormat ?? String);
  const amount = unit === "money" ? compactMoney : (valueFormat ?? String);
  const signed = (v: number) => {
    if (!Number.isFinite(v) || v === 0) return "";
    return v < 0 ? `(${amount(Math.abs(v))})` : `+${amount(v)}`;
  };
  const label = (format: (v: number) => string) => ({
    show: true,
    position: "top" as const,
    color: theme.ink2,
    fontFamily: theme.fontFamily,
    formatter: (p: unknown) => {
      const v = (p as { value: unknown }).value;
      return v === "-" ? "" : format(Number(v));
    },
  });
  const bar = (name: string, data: Cell[], color: string, silent = false, labelFormat?: (v: number) => string) => ({
    name,
    type: "bar" as const,
    stack: "waterfall",
    barMaxWidth: style.barMaxWidth,
    silent,
    itemStyle: { color, borderRadius: name === "base" ? 0 : style.radius },
    data,
    ...(labelFormat ? { label: label(labelFormat) } : {}),
  });
  return {
    ...baseOption(theme, { seriesCount: 1, valueFormat }),
    ...cartesianAxes(theme, { categories: steps.map((s) => s.label), orientation: "vertical", format: valueFormat, unit, categoryLabel: categoryLabels(steps.length) }),
    series: [bar("base", base, "transparent", true), bar("total", total, theme.series[0] ?? theme.other, false, totalFormat), bar("increase", increase, theme.good, false, signed), bar("decrease", decrease, theme.bad, false, (v) => signed(-v))],
  } as ChartOption;
}
