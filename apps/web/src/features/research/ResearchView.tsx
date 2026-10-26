"use client";

import { useEffect, useRef, useState } from "react";
import { JobProgress } from "@/components/domain/JobProgress";
import { ReportDetail, ReportList, ResearchForm } from "@/components/domain/research";
import { useBreadcrumb } from "@/components/shell/BreadcrumbContext";
import { EmptyState, ErrorState, PageHeader, PageSection, Skeleton } from "@/components/ui";
import { useCommand } from "@/hooks/useCommand";
import { useResource } from "@/hooks/useResource";
import { useUrlState } from "@/hooks/useUrlState";
import styles from "./Research.module.css";

export function ResearchView() {
  const [question, setQuestion] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [report, setReport] = useUrlState("report", "");
  const run = useCommand("startMarketResearch");
  const segments = useResource("segments");
  const reports = useResource("researchReports", { sort: "-created_at" });
  const detail = useResource("researchReport", report ? { id: report } : null);
  const job = run.job;
  const active = job?.status === "queued" || job?.status === "running";
  const opened = useRef("");
  useBreadcrumb([{ label: "Origination" }, { label: "Research" }]);

  const resultRef = job?.status === "succeeded" ? job.result_ref : null;
  useEffect(() => {
    if (!job || !resultRef || opened.current === job.id) return;
    opened.current = job.id;
    setReport(resultRef);
    void reports.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, resultRef]);

  const start = () => {
    void run.run({ question: question.trim(), segment_id: segmentId || null }).catch(() => undefined);
  };

  return (
    <>
      <PageHeader title="Research" description="What does the evidence say?" />
      <div className={styles.sections}>
        <PageSection id="new" title="New research">
          <ResearchForm
            question={question}
            onQuestionChange={setQuestion}
            segmentId={segmentId}
            onSegmentChange={setSegmentId}
            segments={(segments.data?.items ?? []).map((s) => ({ value: s.id, label: s.short }))}
            onSubmit={start}
            busy={run.status === "pending" || active}
            error={run.error?.message}
          />
          {job ? (
            <div className={styles.progress}>
              <JobProgress job={job} onRetry={start} testId="research-progress" />
            </div>
          ) : null}
        </PageSection>
        <PageSection id="reports" title="Reports">
          <div className={styles.grid}>
            <div className={styles.left}>
              {reports.isError ? (
                <ErrorState message="Couldn't load the reports." onRetry={() => void reports.refetch()} />
              ) : reports.data ? (
                <ReportList reports={reports.data.items} selectedId={report || undefined} onSelect={setReport} />
              ) : (
                <Skeleton height={96} />
              )}
            </div>
            <div className={styles.right}>
              {!report ? (
                reports.data && reports.data.items.length > 0 ? <EmptyState title="Select a report to read it." /> : null
              ) : detail.isError ? (
                <ErrorState message="Couldn't load this report." onRetry={() => void detail.refetch()} />
              ) : detail.data ? (
                <ReportDetail report={detail.data} />
              ) : (
                <Skeleton height={160} />
              )}
            </div>
          </div>
        </PageSection>
      </div>
    </>
  );
}
