"use client";

import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import styles from "./States.module.css";

export function EmptyState({ title, body, action, testId = "empty-state" }: { title: string; body?: string; action?: ReactNode; testId?: string }) {
  return (
    <div className={styles.empty} data-testid={testId}>
      <Inbox size={28} strokeWidth={1.5} aria-hidden="true" />
      <b className={styles.title}>{title}</b>
      {body ? <p className={styles.body}>{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry, testId = "error-state" }: { message: string; onRetry?: () => void; testId?: string }) {
  return (
    <div className={styles.empty} role="alert" data-testid={testId}>
      <p className={styles.body}>{message}</p>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 16, testId = "skeleton" }: { width?: string | number; height?: string | number; testId?: string }) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden="true" data-testid={testId} />;
}
