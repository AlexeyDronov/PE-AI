import { Fragment, type ReactNode } from "react";
import styles from "./Markdown.module.css";

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*)/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+[.)]\s+(.*)$/;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function blocks(source: string): ReactNode[] {
  const out: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = (lines[i] ?? "").trim();
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    const list = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : null;
    if (!line) {
      i++;
    } else if (heading) {
      out.push(heading[1] === "##" ? <h2 key={i}>{inline(heading[2] ?? "")}</h2> : <h3 key={i}>{inline(heading[2] ?? "")}</h3>);
      i++;
    } else if (list) {
      const start = i;
      const items: ReactNode[] = [];
      for (; i < lines.length; i++) {
        const match = list.exec((lines[i] ?? "").trim());
        if (!match) break;
        items.push(<li key={i}>{inline(match[1] ?? "")}</li>);
      }
      out.push(list === BULLET ? <ul key={start}>{items}</ul> : <ol key={start}>{items}</ol>);
    } else {
      const start = i;
      const text: string[] = [];
      for (; i < lines.length; i++) {
        const next = (lines[i] ?? "").trim();
        if (!next || /^#{2,3}\s/.test(next) || BULLET.test(next) || NUMBERED.test(next)) break;
        text.push(next);
      }
      out.push(<p key={start}>{inline(text.join(" "))}</p>);
    }
  }
  return out;
}

/** Renders a small markdown subset (## ### headings, paragraphs, lists, bold, italic) as React elements; raw HTML stays text. */
export function Markdown({ source, testId = "markdown" }: { source: string; testId?: string }) {
  return (
    <div className={styles.root} data-testid={testId}>
      {blocks(source)}
    </div>
  );
}
