/** Fetches the slim ECharts build on demand; its own module so tests can stand in for it. */
export const loadEcharts = () => import("./echarts");
