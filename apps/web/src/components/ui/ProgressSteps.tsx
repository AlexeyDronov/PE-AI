"use client";

import { Button } from "./Button";
import styles from "./ProgressSteps.module.css";

export type Step = { key: string; label: string };
type StepState = "done" | "current" | "todo" | "failed";

type Props = {
  steps: Step[];
  current: string;
  status: "running" | "succeeded" | "failed";
  error?: string;
  onRetry?: () => void;
  testId?: string;
};

function stateOf(index: number, currentIndex: number, status: Props["status"]): StepState {
  if (status === "succeeded" || index < currentIndex) return "done";
  if (index > currentIndex) return "todo";
  return status === "failed" ? "failed" : "current";
}

export function ProgressSteps({ steps, current, status, error, onRetry, testId = "progress-steps" }: Props) {
  const currentIndex = steps.findIndex((s) => s.key === current);
  return (
    <div className={styles.root} data-testid={testId}>
      <ol className={styles.steps}>
        {steps.map((step, index) => {
          const state = stateOf(index, currentIndex, status);
          return (
            <li key={step.key} className={styles.step} data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <i className={styles.dot} aria-hidden="true" />
              {step.label}
            </li>
          );
        })}
      </ol>
      {status === "failed" && (error || onRetry) ? (
        <p className={styles.error} role="alert">
          {error}
          {onRetry ? (
            <Button variant="ghost" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
