/**
 * ECharts with only the series and components our option builders use (about a third of the full bundle).
 * Chart loads this lazily; add to the lists below when a builder starts using something new.
 */
import { BarChart, HeatmapChart, LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapContinuousComponent,
} from "echarts/components";
import { init, use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

use([
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapContinuousComponent,
  CanvasRenderer,
]);

export { init, use };
export type { EChartsCoreOption as EChartsOption, EChartsType as ECharts } from "echarts/core";
