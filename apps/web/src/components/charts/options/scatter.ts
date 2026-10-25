import { baseOption, tooltipOption, type ChartOption, valueAxis, type ValueFormat } from "./base";
import type { ChartTheme } from "../theme";

export type ScatterPoint = { name: string; x: number; y: number; size: number };
export type ScatterInput = { points: ScatterPoint[]; xLabel: string; yLabel: string; xFormat?: ValueFormat; yFormat?: ValueFormat };

const MAX_DIAMETER = 36;
/** Axis padding as a share of the data range: breathing room plus space for the largest bubble. */
const EDGE_PAD = 0.1;
const BUBBLE_PAD = 0.08;

/** Bubble chart: marker area is proportional to size. */
export function scatterOption({ points, xLabel, yLabel, xFormat, yFormat }: ScatterInput, theme: ChartTheme): ChartOption {
  const scale = MAX_DIAMETER / Math.sqrt(Math.max(...points.map((p) => p.size), 1));
  const padded = (side: "min" | "max") => (e: { min: number; max: number }) => {
    const pad = (e.max - e.min || 1) * (EDGE_PAD + BUBBLE_PAD);
    return side === "min" ? Math.floor(e.min - pad) : Math.ceil(e.max + pad);
  };
  const axisName = (name: string, gap: number) => ({
    name,
    nameLocation: "middle" as const,
    nameGap: gap,
    nameTextStyle: { color: theme.ink3, fontFamily: theme.fontFamily },
    scale: true,
    min: padded("min"),
    max: padded("max"),
  });
  return {
    ...baseOption(theme, { seriesCount: 1 }),
    xAxis: valueAxis(theme, { grid: false, format: xFormat, extra: axisName(xLabel, 28) }),
    yAxis: valueAxis(theme, { grid: true, format: yFormat, extra: axisName(yLabel, 40) }),
    tooltip: {
      ...tooltipOption(theme),
      formatter: (p: unknown) => {
        const [x, y, , name] = (p as { data: [number, number, number, string] }).data;
        return `<b>${name}</b><br/>${xLabel}: ${xFormat ? xFormat(x) : x}<br/>${yLabel}: ${yFormat ? yFormat(y) : y}`;
      },
    },
    series: [
      {
        type: "scatter" as const,
        data: points.map((p) => [p.x, p.y, p.size, p.name]),
        symbolSize: (d: unknown[]) => scale * Math.sqrt(Number(d[2])),
        itemStyle: { color: theme.series[0], opacity: 0.8, borderColor: theme.surface, borderWidth: 2 },
        label: { show: true, position: "top", distance: 4, color: theme.ink2, fontFamily: theme.fontFamily, formatter: (p: unknown) => String((p as { data: unknown[] }).data[3]) },
      },
    ],
  } as ChartOption;
}
