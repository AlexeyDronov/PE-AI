import styles from "./Research.module.css";
import type { Source } from "./types";

export function SourceList({ sources }: { sources: Source[] }) {
  return (
    <ol className={styles.sources} data-testid="source-list">
      {sources.map((s) => (
        <li key={s.id} className={styles.source}>
          <span>
            <span className={styles.ref}>[{s.ref}]</span>{" "}
            <a className={styles.link} href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title}
            </a>
          </span>
          {s.publisher ? <span className={styles.meta}>{s.publisher}</span> : null}
          {s.excerpt ? <blockquote className={styles.quote}>{s.excerpt}</blockquote> : null}
        </li>
      ))}
    </ol>
  );
}
