import type { ChartTheme } from "../theme";

/** Plain ECharts option object; the builders stay pure and the Chart wrapper hands it to echarts. */
export type ChartOption = Record<string, unknown>;
export type ValueFormat = (value: number) => string;
export type Orientation = "vertical" | "horizontal";
export type Role = "primary" | "comparison";
export type Unit = "money";

const MINUS = "\u2212";

function trimmed(n: number): string {
  return String(Number(n.toFixed(1)));
}

/** Compact money tick label for an input in £m, e.g. £40m, £1.2bn, −£200m. */
export function compactMoney(v: number): string {
  const abs = Math.abs(v);
  const body = abs >= 1000 ? `£${trimmed(abs / 1000)}bn` : `£${trimmed(abs)}m`;
  if (abs === 0) return "£0";
  return v < 0 ? `${MINUS}${body}` : body;
}

/** Vertical category labels: show every one, wrapping long ones. */
export const CATEGORY_LABELS = { interval: 0, overflow: "break", width: 80 };

const BAR_THICKNESS = 16;

export function seriesColor(theme: ChartTheme, index: number, role: Role = "primary"): string {
  return role === "comparison" ? theme.other : (theme.series[index] ?? theme.other);
}

export function tooltipOption(theme: ChartTheme, opts: { trigger?: "item" | "axis"; valueFormat?: ValueFormat } = {}) {
  const format = opts.valueFormat;
  return {
    trigger: opts.trigger ?? "item",
    confine: true,
    backgroundColor: theme.raised,
    borderColor: theme.line,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: theme.ink, fontFamily: theme.fontFamily, fontSize: 12 },
    axisPointer: { type: opts.trigger === "axis" ? "line" : "shadow", lineStyle: { color: theme.lineStrong }, shadowStyle: { color: "transparent" } },
    ...(format ? { valueFormatter: (v: unknown) => format(Number(v)) } : {}),
  };
}

/** Shared chrome: font, grid, tooltip, legend rule (square swatches, only for two or more series). */
export function baseOption(theme: ChartTheme, opts: { seriesCount: number; trigger?: "item" | "axis"; valueFormat?: ValueFormat }): ChartOption {
  const legend = opts.seriesCount >= 2;
  return {
    textStyle: { fontFamily: theme.fontFamily, color: theme.ink2 },
    animationDuration: 400,
    animationDurationUpdate: 250,
    animationEasing: "cubicOut",
    animationEasingUpdate: "cubicOut",
    grid: { left: 8, right: 24, top: legend ? 40 : 16, bottom: 8, containLabel: true },
    legend: {
      show: legend,
      left: 0,
      top: 0,
      icon: "rect",
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
      textStyle: { color: theme.ink2, fontFamily: theme.fontFamily },
    },
    tooltip: tooltipOption(theme, opts),
  };
}

export function categoryAxis(theme: ChartTheme, data: string[], extra: { inverse?: boolean; label?: Record<string, unknown> } = {}) {
  return {
    type: "category" as const,
    data,
    inverse: extra.inverse,
    axisLine: { lineStyle: { color: theme.lineStrong } },
    axisTick: { show: false },
    axisLabel: { color: theme.ink2, fontFamily: theme.fontFamily, hideOverlap: true, ...extra.label },
    splitLine: { show: false },
  };
}

/** Value axis; only a vertical value axis (horizontal gridlines) draws gridlines. */
export function valueAxis(theme: ChartTheme, opts: { grid: boolean; format?: ValueFormat; unit?: Unit; extra?: Record<string, unknown> }) {
  const format = opts.unit === "money" ? compactMoney : opts.format;
  return {
    type: "value" as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: theme.ink3, fontFamily: theme.fontFamily, ...(format ? { formatter: (v: number) => format(v) } : {}) },
    splitLine: { show: opts.grid, lineStyle: { color: theme.line } },
    ...opts.extra,
  };
}

/** Category + value axes for either orientation; the category axis is the x axis when vertical. */
export function cartesianAxes(
  theme: ChartTheme,
  opts: { categories: string[]; orientation: Orientation; format?: ValueFormat; unit?: Unit; valueExtra?: Record<string, unknown>; categoryLabel?: Record<string, unknown> },
) {
  const horizontal = opts.orientation === "horizontal";
  const category = categoryAxis(theme, opts.categories, { inverse: horizontal, label: opts.categoryLabel });
  const value = valueAxis(theme, { grid: !horizontal, format: opts.format, unit: opts.unit, extra: opts.valueExtra });
  return horizontal ? { xAxis: value, yAxis: category } : { xAxis: category, yAxis: value };
}

export function barStyle(orientation: Orientation) {
  return { barMaxWidth: BAR_THICKNESS, barGap: "15%", radius: orientation === "horizontal" ? [0, 3, 3, 0] : [3, 3, 0, 0] };
}
