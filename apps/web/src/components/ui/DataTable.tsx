"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useMemo, useState } from "react";
import styles from "./DataTable.module.css";
import { ErrorState, Skeleton } from "./States";

export type Column<Row> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
  sub?: (row: Row) => ReactNode;
  sortValue?: (row: Row) => string | number;
  width?: string | number;
};

type Props<Row> = {
  label: string;
  columns: Column<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  selectedId?: string;
  onRowClick?: (row: Row) => void;
  isRecent?: (id: string) => boolean;
  loading?: boolean;
  empty?: string;
  error?: string;
  onRetry?: () => void;
  testId?: string;
};

type Sort = { key: string; direction: "ascending" | "descending" };

const SKELETON_ROWS = 5;

function compare(a: string | number, b: string | number): number {
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
}

export function DataTable<Row>({
  label,
  columns,
  rows,
  getRowId,
  selectedId,
  onRowClick,
  isRecent,
  loading,
  empty = "Nothing to show.",
  error,
  onRetry,
  testId = "data-table",
}: Props<Row>) {
  const [sort, setSort] = useState<Sort | null>(null);

  const sorted = useMemo(() => {
    const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
    if (!sort || !column?.sortValue) return rows;
    const value = column.sortValue;
    const sign = sort.direction === "ascending" ? 1 : -1;
    return [...rows].sort((a, b) => sign * compare(value(a), value(b)));
  }, [rows, columns, sort]);

  function toggleSort(key: string) {
    setSort((prev) => ({ key, direction: prev?.key === key && prev.direction === "ascending" ? "descending" : "ascending" }));
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, index: number) {
    if (!onRowClick) return;
    const target = event.key === "ArrowDown" ? sorted[index + 1] : event.key === "ArrowUp" ? sorted[index - 1] : event.key === "Enter" ? sorted[index] : undefined;
    if (event.key !== "Enter" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!target) return;
    onRowClick(target);
    const sibling = event.key === "ArrowDown" ? event.currentTarget.nextElementSibling : event.key === "ArrowUp" ? event.currentTarget.previousElementSibling : null;
    if (sibling instanceof HTMLElement) sibling.focus();
  }

  const focusableId = selectedId ?? (sorted[0] ? getRowId(sorted[0]) : undefined);
  const showRows = !loading && !error && sorted.length > 0;
  const message = !loading && !error && sorted.length === 0;

  return (
    <div className={styles.scroll} data-testid={testId}>
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = Boolean(column.sortValue);
              const active = sort?.key === column.key ? sort.direction : undefined;
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={styles.th}
                  data-align={column.align ?? "left"}
                  aria-sort={sortable ? (active ?? "none") : undefined}
                  style={column.width !== undefined ? { width: column.width } : undefined}
                >
                  {sortable ? (
                    <button type="button" className={styles.sortButton} onClick={() => toggleSort(column.key)}>
                      {column.header}
                      <span className={styles.sortIcon} aria-hidden="true">
                        {active === "descending" ? <ChevronDown size={12} strokeWidth={1.5} /> : active === "ascending" ? <ChevronUp size={12} strokeWidth={1.5} /> : null}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, r) => (
                <tr key={r} className={styles.row}>
                  {columns.map((column) => (
                    <td key={column.key} className={styles.td} data-align={column.align ?? "left"}>
                      <Skeleton width={column.align === "right" ? "50%" : "70%"} height={14} />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          {error ? (
            <tr>
              <td colSpan={columns.length}>
                <ErrorState message={error} onRetry={onRetry} />
              </td>
            </tr>
          ) : null}
          {message ? (
            <tr>
              <td colSpan={columns.length} className={styles.message}>
                {empty}
              </td>
            </tr>
          ) : null}
          {showRows
            ? sorted.map((row, index) => {
                const id = getRowId(row);
                return (
                  <tr
                    key={id}
                    className={styles.row}
                    data-clickable={onRowClick ? "true" : undefined}
                    data-recent={isRecent?.(id) ? "true" : undefined}
                    aria-selected={onRowClick ? id === selectedId : undefined}
                    tabIndex={onRowClick ? (id === focusableId ? 0 : -1) : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={(event) => onRowKeyDown(event, index)}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className={styles.td} data-align={column.align ?? "left"}>
                        <div className={styles.main}>{column.render(row)}</div>
                        {column.sub ? <div className={styles.sub}>{column.sub(row)}</div> : null}
                      </td>
                    ))}
                  </tr>
                );
              })
            : null}
        </tbody>
      </table>
    </div>
  );
}
