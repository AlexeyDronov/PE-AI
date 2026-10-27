import { Badge, EmptyState } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./Research.module.css";
import type { ReportSummary } from "./types";

type Props = { reports: ReportSummary[]; selectedId?: string; onSelect: (id: string) => void };

export function ReportList({ reports, selectedId, onSelect }: Props) {
  if (reports.length === 0) return <EmptyState title="No research yet." body="Run a question above and the cited report will appear here." />;
  return (
    <ul className={styles.list} data-testid="report-list">
      {reports.map((r) => (
        <li key={r.id}>
          <button type="button" className={styles.item} aria-pressed={r.id === selectedId} onClick={() => onSelect(r.id ?? "")}>
            <b>{r.question}</b>
            <span className={styles.snippet}>{r.summary}</span>
            {r.status === "partial" && (
              <span className={styles.flag}>
                <Badge tone="warn">Partial answer</Badge>
              </span>
            )}
            <span className={styles.meta}>{fmt.date(r.created_at ?? undefined)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
