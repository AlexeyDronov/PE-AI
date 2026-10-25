"use client";

import * as echarts from "echarts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button, type Column, DataTable, Skeleton } from "@/components/ui";
import type { ChartOption } from "./options";
import styles from "./Chart.module.css";

export type ChartSelection = { name: string; dataIndex: number; seriesName: string };

type Props<Row> = {
  label: string;
  option: ChartOption;
  table: { columns: Column<Row>[]; rows: Row[]; getRowId: (row: Row) => string };
  height?: number;
  loading?: boolean;
  onSelect?: (selection: ChartSelection) => void;
  testId?: string;
};

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function Chart<Row>({ label, option, table, height = 280, loading = false, onSelect, testId = "chart" }: Props<Row>) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const onSelectRef = useRef(onSelect);
  const plotted = view === "chart" && !loading;

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const el = container.current;
    if (!plotted || !el) return;
    const chart = echarts.init(el);
    instance.current = chart;
    chart.on("click", (params: unknown) => {
      const { name, dataIndex, seriesName } = params as ChartSelection;
      onSelectRef.current?.({ name, dataIndex, seriesName });
    });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => chart.resize());
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      chart.dispose();
      instance.current = null;
    };
  }, [plotted]);

  useEffect(() => {
    if (!plotted) return;
    instance.current?.setOption((prefersReducedMotion() ? { ...option, animation: false } : option) as echarts.EChartsOption, { notMerge: true });
  }, [option, plotted]);

  let body: ReactNode;
  if (loading) body = <Skeleton height={height} />;
  else if (view === "table") body = <DataTable label={label} columns={table.columns} rows={table.rows} getRowId={table.getRowId} />;
  else body = <div ref={container} role="img" aria-label={label} className={styles.plot} style={{ height }} />;

  return (
    <div className={styles.root} data-testid={testId}>
      {body}
      {loading ? null : (
        <div className={styles.toggle}>
          <Button variant="ghost" size="sm" onClick={() => setView(view === "chart" ? "table" : "chart")}>
            {view === "chart" ? "View as table" : "View as chart"}
          </Button>
        </div>
      )}
    </div>
  );
}
