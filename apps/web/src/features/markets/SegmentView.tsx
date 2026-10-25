"use client";

import { CompetitiveLandscape, ResearchEvidence, SegmentProfile } from "@/components/domain/markets";
import { useBreadcrumb } from "@/components/shell/BreadcrumbContext";
import { ButtonLink, ErrorState, OnThisPage, PageHeader, PageSection, Skeleton } from "@/components/ui";
import { useCommand } from "@/hooks/useCommand";
import { useResource } from "@/hooks/useResource";
import { ApiError } from "@/lib/api/client";
import styles from "./Segment.module.css";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "landscape", label: "Competitive landscape" },
  { id: "evidence", label: "Evidence" },
];

export function SegmentView({ segmentId }: { segmentId: string }) {
  const segment = useResource("segment", { id: segmentId });
  const research = useCommand("startMarketResearch");
  const data = segment.data;
  useBreadcrumb(data ? [{ label: "Origination" }, { label: "Markets", href: "/markets" }, { label: data.short }] : undefined);

  if (segment.error instanceof ApiError && segment.error.code === "not_found") {
    return (
      <div className={styles.missing} data-testid="segment-missing">
        <ErrorState message="We couldn't find that segment." />
        <ButtonLink href="/markets">Back to markets</ButtonLink>
      </div>
    );
  }
  if (segment.isError) return <ErrorState message="Couldn't load this segment." onRetry={() => void segment.refetch()} />;
  if (!data) return <Skeleton height={96} />;

  return (
    <>
      <PageHeader title={data.name} description={`${data.fragmentation} fragmentation · ${data.ai_exposure} AI exposure`} />
      <div className={styles.layout}>
        <div className={styles.sections}>
          <PageSection id="profile" title="Profile">
            <SegmentProfile segment={data} />
          </PageSection>
          <PageSection id="landscape" title="Competitive landscape">
            <CompetitiveLandscape transactions={data.transactions} players={data.players} />
          </PageSection>
          <PageSection id="evidence" title="Evidence">
            <ResearchEvidence
              reports={data.reports}
              job={research.job}
              starting={research.status === "pending"}
              error={research.error?.message}
              onRun={(question) => void research.run({ question, segment_id: segmentId }).catch(() => undefined)}
            />
          </PageSection>
        </div>
        <OnThisPage items={SECTIONS} />
      </div>
    </>
  );
}
