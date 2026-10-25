import type { ReactNode } from "react";
import styles from "./Badge.module.css";

export type Tone = "neutral" | "good" | "warn" | "bad" | "accent";

export function Badge({ tone = "neutral", children, testId = "badge" }: { tone?: Tone; children: ReactNode; testId?: string }) {
  return (
    <span className={styles.root} data-tone={tone} data-testid={testId}>
      {children}
    </span>
  );
}
