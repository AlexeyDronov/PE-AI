"use client";

import { Bookmark } from "lucide-react";
import { usePathname } from "next/navigation";
import { VERDICT_TONE } from "@/components/domain/verdict";
import { useBreadcrumb } from "@/components/shell/BreadcrumbContext";
import { Badge, Button, ButtonLink, ErrorState, PageHeader, Skeleton, type TabItem, Tabs } from "@/components/ui";
import { useCommand } from "@/hooks/useCommand";
import { useResource } from "@/hooks/useResource";
import { ApiError } from "@/lib/api/client";
import styles from "./DealHeader.module.css";

function dealTabs(dealId: string): TabItem[] {
  return [
    { value: "overview", label: "Overview", href: `/deals/${dealId}` },
    { value: "model", label: "Model", href: `/deals/${dealId}/model` },
    { value: "memo", label: "IC memo", href: `/deals/${dealId}/memo` },
  ];
}

export function DealHeader({ dealId }: { dealId: string }) {
  const pathname = usePathname();
  const deal = useResource("deal", { id: dealId });
  const watch = useCommand("setWatchlist");
  const data = deal.data;
  useBreadcrumb(data ? [{ label: "Deals", href: "/deals" }, { label: data.company.name }] : undefined);

  if (deal.error instanceof ApiError && deal.error.code === "not_found") {
    return (
      <div className={styles.missing} data-testid="deal-header">
        <ErrorState message="We couldn't find that deal." />
        <ButtonLink href="/deals">Back to pipeline</ButtonLink>
      </div>
    );
  }
  if (deal.isError) return <ErrorState message="Couldn't load this deal." onRetry={() => void deal.refetch()} />;
  if (!data) return <Skeleton height={96} />;

  const tabs = dealTabs(dealId);
  const active = tabs.find((tab) => tab.value !== "overview" && tab.href && pathname.startsWith(tab.href)) ?? tabs[0];
  const { screening } = data;
  const toggle = () => void watch.run({ deal_id: dealId, on: !data.watchlisted }).catch(() => undefined);

  return (
    <PageHeader
      testId="deal-header"
      title={data.company.name}
      meta={
        <>
          <span className={styles.code}>{data.code_name}</span>
          <span>{data.segment.short}</span>
          <span>{data.company.hq}</span>
          <Badge>{data.stage}</Badge>
          <Badge tone={VERDICT_TONE[screening.verdict]}>{screening.verdict}</Badge>
          {screening.gate_reason ? <span className={styles.caption}>{screening.gate_reason}</span> : null}
        </>
      }
      actions={
        <>
          <Button
            writes
            icon={<Bookmark size={16} strokeWidth={1.5} />}
            aria-pressed={data.watchlisted}
            loading={watch.status === "pending"}
            onClick={toggle}
          >
            {data.watchlisted ? "On watchlist" : "Add to watchlist"}
          </Button>
          <ButtonLink href={`/deals/${dealId}/model`} variant="primary">
            Build model
          </ButtonLink>
        </>
      }
      tabs={<Tabs label="Deal" value={active?.value ?? "overview"} tabs={tabs} />}
    />
  );
}
