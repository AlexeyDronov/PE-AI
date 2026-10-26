"use client";

import { useState } from "react";
import { JobProgress } from "@/components/domain/JobProgress";
import { Button, Card, EmptyState, Textarea } from "@/components/ui";
import type { Job } from "@/lib/api/types";
import { fmt } from "@/lib/format";
import styles from "./ResearchEvidence.module.css";
import type { Report } from "./types";

type Props = { reports: Report[]; job?: Job; starting?: boolean; error?: string; onRun: (question: string) => void };

export function ResearchEvidence({ reports, job, starting, error, onRun }: Props) {
  const [question, setQuestion] = useState("");
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
            <Button variant="primary" writes loading={starting} disabled={!question.trim()} onClick={() => onRun(question.trim())}>
              Run research
            </Button>
          </div>
        </div>
        {job ? (
          <div className={styles.job}>
            <JobProgress job={job} testId="research-job" />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
