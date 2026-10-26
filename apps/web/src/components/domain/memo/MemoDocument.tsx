import { Badge, Button, Markdown } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./Memo.module.css";

export type MemoDocumentData = {
  scenario_name: string | null;
  created_at: string;
  sections: { id: string; key: string; label: string; status: string; markdown: string }[];
};

type Props = { memo: MemoDocumentData; onCopy: () => void; onExport: () => void; copied: boolean };

/** One drafted IC memo: its sections with status, plus copy and export. */
export function MemoDocument({ memo, onCopy, onExport, copied }: Props) {
  return (
    <article className={styles.document} data-testid="memo-document">
      <header className={styles.meta}>
        <span>
          {memo.scenario_name ?? "Base case"} · {fmt.date(memo.created_at)}
        </span>
        <span className={styles.actions}>
          <Button size="sm" onClick={onCopy}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button size="sm" onClick={onExport}>
            Export
          </Button>
        </span>
      </header>
      {memo.sections.map((s) => (
        <section key={s.id} className={styles.section} aria-label={s.label}>
          <div className={styles.sectionHead}>
            <Badge tone="neutral">{s.status === "draft" ? "Draft" : s.status}</Badge>
          </div>
          <Markdown source={s.markdown} />
        </section>
      ))}
    </article>
  );
}
