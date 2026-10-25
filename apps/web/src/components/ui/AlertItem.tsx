import { Badge, type Tone } from "./Badge";
import styles from "./AlertItem.module.css";

export type Severity = "bad" | "warn" | "good" | "info" | "neutral";

const TONE: Record<Severity, Tone> = { bad: "bad", warn: "warn", good: "good", info: "accent", neutral: "neutral" };

type Props = {
  severity: Severity;
  label: string;
  title: string;
  body?: string;
  action?: string;
  meta?: string;
  testId?: string;
};

export function AlertItem({ severity, label, title, body, action, meta, testId = "alert-item" }: Props) {
  return (
    <div className={styles.root} data-severity={severity} data-testid={testId}>
      <div className={styles.head}>
        <Badge tone={TONE[severity]}>{label}</Badge>
        <span className={styles.title}>{title}</span>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>
      {body ? <p className={styles.body}>{body}</p> : null}
      {action ? <p className={styles.action}>Suggested: {action}</p> : null}
    </div>
  );
}
