"use client";

import { useEffect, useRef, useState } from "react";
import { JobProgress } from "@/components/domain/JobProgress";
import { MemoDocument, MemoPicker } from "@/components/domain/memo";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useCommand } from "@/hooks/useCommand";
import { useResource } from "@/hooks/useResource";
import styles from "./DealMemo.module.css";

const STEPS = [
  { key: "context", label: "Build context" },
  { key: "draft", label: "Draft sections" },
  { key: "save", label: "Save" },
];

export function DealMemo({ dealId }: { dealId: string }) {
  const [unchecked, setUnchecked] = useState<string[]>([]);
  const [scenarioId, setScenarioId] = useState("");
  const [copied, setCopied] = useState(false);
  const outline = useResource("memoOutline");
  const scenarios = useResource("lboScenarios", { deal_id: dealId });
  const memos = useResource("memos", { deal_id: dealId, sort: "-created_at" });
  const latestId = memos.data?.items[0]?.id;
  const memo = useResource("memo", latestId ? { id: latestId } : null);
  const draft = useCommand("draftMemo");
  const job = draft.job;
  const active = job?.status === "queued" || job?.status === "running";
  const seen = useRef("");

  const sections = outline.data?.sections ?? [];
  const selected = sections.filter((s) => !unchecked.includes(s.key)).map((s) => s.key);

  const done = job?.status === "succeeded" ? job.id : "";
  useEffect(() => {
    if (!done || seen.current === done) return;
    seen.current = done;
    void memos.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const start = () => {
    void draft.run({ deal_id: dealId, scenario_id: scenarioId || null, sections: selected }).catch(() => undefined);
  };

  const markdown = () => (memo.data?.sections ?? []).map((s) => s.markdown).join("\n\n");
  const copy = () => {    void navigator.clipboard.writeText(markdown()).then(() => setCopied(true));
  };
  const exportMarkdown = () => {
    const url = URL.createObjectURL(new Blob([markdown()], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ic-memo-${dealId}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.layout} data-testid="deal-memo">
      <div className={styles.left}>
        <MemoPicker
          sections={sections}
          selected={selected}
          onToggle={(key, checked) => setUnchecked((prev) => (checked ? prev.filter((k) => k !== key) : [...prev, key]))}
          scenarioId={scenarioId}
          scenarios={(scenarios.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))}
          onScenarioChange={setScenarioId}
          onDraft={start}
          busy={draft.status === "pending" || active}
        />
        {draft.error ? <ErrorState message={draft.error.message} onRetry={start} /> : null}
        {job ? (
          <div className={styles.progress}>
            <JobProgress job={job} steps={STEPS} onRetry={start} testId="memo-progress" />
          </div>
        ) : null}
      </div>
      <div className={styles.right}>
        {memos.isError || memo.isError ? (
          <ErrorState message="Couldn't load the memo." onRetry={() => void (memos.isError ? memos.refetch() : memo.refetch())} />
        ) : memo.data ? (
          <MemoDocument memo={memo.data} onCopy={copy} onExport={exportMarkdown} copied={copied} />
        ) : memos.data && !latestId ? (
          <EmptyState title="No memo yet" body="Choose the sections and scenario, then draft the first IC memo." />
        ) : (
          <Skeleton height={160} />
        )}
      </div>
    </div>
  );
}
