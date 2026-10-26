"use client";

import { useEffect, useRef, useState } from "react";
import { JobProgress } from "@/components/domain/JobProgress";
import { TeaserIntake, TeaserResult } from "@/components/domain/teaser";
import { useBreadcrumb } from "@/components/shell/BreadcrumbContext";
import { ErrorState, PageHeader, PageSection, Skeleton } from "@/components/ui";
import { useCommand } from "@/hooks/useCommand";
import { useResource } from "@/hooks/useResource";
import styles from "./Teaser.module.css";

const STEPS = [
  { key: "extract", label: "Extract figures" },
  { key: "score", label: "Score against the mandate" },
  { key: "flags", label: "Flag risks" },
];

export function TeaserScreenView() {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");
  const screen = useCommand("screenTeaser");
  const funds = useResource("funds");
  const job = screen.job;
  const dealId = job?.status === "succeeded" ? job.result_ref : null;
  const deal = useResource("deal", dealId ? { id: dealId } : null);
  const active = job?.status === "queued" || job?.status === "running";
  const wantScroll = useRef(false);
  const fund = funds.data?.items[0];
  useBreadcrumb([{ label: "Deals", href: "/deals" }, { label: "Screen a teaser" }]);

  useEffect(() => {
    if (!job || !wantScroll.current) return;
    const el = document.getElementById("progress");
    if (!el) return;
    wantScroll.current = false;
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [job]);

  const start = (value: string) => {
    wantScroll.current = true;
    setSubmitted(value);
    void screen.run({ text: value }).catch(() => undefined);
  };

  return (
    <>
      <PageHeader title="Screen a teaser" description="Does this new opportunity fit the mandate?" />
      <div className={styles.sections}>
        <PageSection id="teaser" title="Teaser">
          <TeaserIntake
            value={text}
            onChange={setText}
            onSubmit={() => start(text.trim())}
            busy={screen.status === "pending" || active}
            error={screen.error?.message}
          />
        </PageSection>
        {job ? (
          <PageSection id="progress" title="Progress">
            <JobProgress job={job} steps={STEPS} onRetry={() => start(submitted)} testId="teaser-progress" />
          </PageSection>
        ) : null}
        {dealId ? (
          <PageSection id="result" title="Result">
            {deal.isError ? (
              <ErrorState message="Couldn't load the screened deal." onRetry={() => void deal.refetch()} />
            ) : deal.data ? (
              <TeaserResult deal={deal.data} thresholds={{ good: fund?.verdict_advance ?? 0, warn: fund?.verdict_watch ?? 0 }} />
            ) : (
              <Skeleton height={96} />
            )}
          </PageSection>
        ) : null}
      </div>
    </>
  );
}
