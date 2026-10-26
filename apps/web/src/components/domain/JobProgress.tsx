import { Badge, ProgressSteps, type Step } from "@/components/ui";
import type { Job } from "@/lib/api/types";
import { fmt } from "@/lib/format";
import { JOB_STATUS_TONE, jobKindLabel } from "./jobs";
import styles from "./JobProgress.module.css";

type Props = {
  job: Job;
  /** Fixed steps for the job kind; when omitted the steps are the ones the agent has reported. */
  steps?: Step[];
  onRetry?: () => void;
  testId?: string;
};

const STATUS_LABEL: Record<Job["status"], string> = { queued: "Queued", running: "Running", succeeded: "Done", failed: "Failed" };

function costUsd(job: Job): number | undefined {
  const cost = job.usage?.costUsd;
  return typeof cost === "number" ? cost : undefined;
}

/** The steps, status, error with retry, and model cost of one Copilot job. */
export function JobProgress({ job, steps, onRetry, testId = "job-progress" }: Props) {
  const reported = job.progress.at(-1)?.step ?? "";
  const shown = steps ?? job.progress.map((p) => ({ key: p.step, label: p.message }));
  const current = shown.some((s) => s.key === reported) ? reported : (shown[0]?.key ?? "");
  const cost = costUsd(job);
  return (
    <div className={styles.root} aria-live="polite" data-testid={testId}>
      <span>
        {jobKindLabel(job.kind)} <Badge tone={JOB_STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
      </span>
      {shown.length ? (
        <ProgressSteps
          steps={shown}
          current={current}
          status={job.status === "queued" ? "running" : job.status}
          error={job.error ?? undefined}
          onRetry={onRetry}
        />
      ) : null}
      {cost !== undefined ? <span className={styles.cost}>Cost {fmt.usd(cost)}</span> : null}
    </div>
  );
}
