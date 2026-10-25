"use client";

import { useState } from "react";
import { jobKindLabel, JOB_STATUS_TONE } from "@/components/domain/jobs";
import { Badge, Button, Card, EmptyState, ProgressSteps, Textarea } from "@/components/ui";
import type { Job } from "@/lib/api/types";
import { fmt } from "@/lib/format";
import styles from "./ResearchEvidence.module.css";
import type { Report } from "./types";

type Props = { reports: Report[]; job?: Job; starting?: boolean; error?: string; onRun: (question: string) => void };

const STATUS_LABEL: Record<Job["status"], string> = { queued: "Queued", running: "Running", succeeded: "Done", failed: "Failed" };

export function ResearchEvidence({ reports, job, starting, error, onRun }: Props) {
  const [question, setQuestion] = useState("");
  const steps = job?.progress.map((p) => ({ key: p.step, label: p.message })) ?? [];
  const current = job?.progress.at(-1)?.step ?? "";
  return (
    <div className={styles.root} data-testid="research-evidence">
      <Card title="Research reports" testId="segment-reports">
        {reports.length === 0 ? (
          <EmptyState title="No research yet for this segment." />
        ) : (
          <ul className={styles.list}>
            {reports.map((r) => (
              <li key={r.id} className={styles.report}>
                <b>{r.question}</b>
                <span>{r.summary}</span>
                <span className={styles.meta}>{fmt.date(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Run research" description="Ask the Copilot a question about this segment" testId="run-research">
        <div className={styles.form}>
          <Textarea label="Research question" value={question} onChange={setQuestion} error={error} />
          <div>
            <Button variant="primary" loading={starting} disabled={!question.trim()} onClick={() => onRun(question.trim())}>
              Run research
            </Button>
          </div>
        </div>
        {job ? (
          <div className={styles.job} aria-live="polite">
            <span>
              {jobKindLabel(job.kind)} <Badge tone={JOB_STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
            </span>
            {steps.length ? <ProgressSteps steps={steps} current={current} status={job.status === "queued" ? "running" : job.status} error={job.error ?? undefined} /> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
