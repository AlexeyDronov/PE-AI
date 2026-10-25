"use client";

import { CapitalStructure, ExitPlanCard, PlatformAlerts, QuarterlyEbitda, ValueCreationChart } from "@/components/domain/portfolio";
import { platformTone } from "@/components/domain/platformStatus";
import { useBreadcrumb } from "@/components/shell/BreadcrumbContext";
import { Badge, ButtonLink, EmptyState, ErrorState, OnThisPage, PageHeader, PageSection, Skeleton, StatStrip } from "@/components/ui";
import { useResource } from "@/hooks/useResource";
import { ApiError } from "@/lib/api/client";
import { fmt } from "@/lib/format";
import styles from "./PlatformView.module.css";

const SECTIONS = [
  { id: "snapshot", label: "Snapshot" },
  { id: "performance", label: "Performance" },
  { id: "capital-structure", label: "Capital structure" },
  { id: "value-creation", label: "Value creation" },
  { id: "alerts", label: "Alerts and actions" },
  { id: "exit-plan", label: "Exit plan" },
];

export function PlatformView({ platformId }: { platformId: string }) {
  const platform = useResource("portfolioCompany", { id: platformId });
  const covenants = useResource("covenantSummary");
  const data = platform.data;
  useBreadcrumb(data ? [{ label: "Portfolio" }, { label: "Platforms", href: "/portfolio" }, { label: data.company.name }] : undefined);

  if (platform.error instanceof ApiError && platform.error.code === "not_found") {
    return (
      <div className={styles.missing} data-testid="platform-missing">
        <ErrorState message="We couldn't find that platform." />
        <ButtonLink href="/portfolio">Back to platforms</ButtonLink>
      </div>
    );
  }
  if (platform.isError || covenants.isError) {
    return (
      <ErrorState
        message="Couldn't load this platform."
        onRetry={() => {
          void platform.refetch();
          void covenants.refetch();
        }}
      />
    );
  }
  if (!data || !covenants.data) return <Skeleton height={96} />;

  const levers = data.value_creation.map((l) => ({ label: l.lever, value: l.amount }));
  const stats = [
    { label: "Fair value", value: fmt.money(data.fair_value) },
    { label: "MOIC", value: fmt.multiple(data.moic, { dp: 2 }) },
    { label: "LTM EBITDA", value: fmt.money(data.ebitda_ltm), hint: `${fmt.pct(data.budget_variance, { signed: true })} vs budget` },
    { label: "Net leverage", value: fmt.multiple(data.net_leverage) },
    { label: "Revenue", value: fmt.money(data.revenue) },
  ];

  return (
    <>
      <PageHeader
        title={data.company.name}
        meta={
          <>
            <span className={styles.meta}>{data.segment.short}</span>
            <span className={styles.meta}>Invested {data.invest_year}</span>
            <Badge tone={platformTone(data.status)}>{data.status_label}</Badge>
          </>
        }
      />
      <div className={styles.layout}>
        <div className={styles.sections}>
          <PageSection id="snapshot" title="Snapshot">
            <StatStrip items={stats} count={5} />
          </PageSection>

          <PageSection id="performance" title="Performance">
            <QuarterlyEbitda quarters={data.quarters} />
          </PageSection>

          <PageSection id="capital-structure" title="Capital structure" description="Facility terms and covenant headroom">
            <CapitalStructure facility={data.facility} threshold={covenants.data.comfort_threshold} />
          </PageSection>

          <PageSection id="value-creation" title="Value creation" description="Where the change in value came from">
            {levers.length === 0 ? (
              <EmptyState title="No value creation levers recorded" />
            ) : (
              <ValueCreationChart steps={[{ label: "Invested", value: data.invested }, ...levers, { label: "Fair value", value: data.fair_value }]} />
            )}
          </PageSection>

          <PageSection id="alerts" title="Alerts and actions">
            <PlatformAlerts alerts={data.alerts} />
          </PageSection>

          <PageSection id="exit-plan" title="Exit plan">
            <ExitPlanCard plan={data.exit_plan} moic={data.moic} />
          </PageSection>
        </div>
        <OnThisPage items={SECTIONS} />
      </div>
    </>
  );
}
