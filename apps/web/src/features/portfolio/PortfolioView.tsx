"use client";

import { useRouter } from "next/navigation";
import { EbitdaVsBudget, PlatformsTable, ValueCreationChart } from "@/components/domain/portfolio";
import { PageHeader, PageSection, StatStrip } from "@/components/ui";
import { useResource } from "@/hooks/useResource";
import { fmt } from "@/lib/format";
import styles from "./Portfolio.module.css";

export function PortfolioView() {
  const router = useRouter();
  const platforms = useResource("portfolioCompanies");
  const summary = useResource("portfolioSummary");

  const s = summary.data;
  const stats = s
    ? [
        { label: "Fair value", value: fmt.money(s.fair_value) },
        { label: "Invested", value: fmt.money(s.invested) },
        { label: "Gross MOIC", value: fmt.multiple(s.moic, { dp: 2 }) },
        { label: "On plan", value: fmt.int(s.status_counts.good ?? 0) },
        { label: "Need action", value: fmt.int(s.status_counts.bad ?? 0) },
      ]
    : [];

  return (
    <>
      <PageHeader title="Platforms" description="How each portfolio company is performing against its budget and its lenders." />

      <PageSection id="summary" title="Summary">
        <StatStrip items={stats} loading={!s} count={5} />
      </PageSection>

      <PageSection id="platforms" title="Platforms" description="Select a platform to see its performance, debt and exit plan">
        <PlatformsTable
          platforms={platforms.data?.items ?? []}
          onOpen={(platform) => router.push(`/portfolio/${platform.id}`)}
          loading={platforms.isPending}
          error={platforms.isError ? "Couldn't load platforms." : undefined}
          onRetry={() => void platforms.refetch()}
        />
      </PageSection>

      {platforms.data && s ? (
        <PageSection id="performance" title="Performance">
          <div className={styles.pair}>
            <EbitdaVsBudget platforms={platforms.data.items} />
            <ValueCreationChart steps={s.value_bridge} description="From invested capital to fair value" />
          </div>
        </PageSection>
      ) : null}
    </>
  );
}
