import { DealLinks } from "@/components/domain/pipeline/DealLinks";
import type { Deal } from "@/components/domain/pipeline/types";
import { Card, Skeleton } from "@/components/ui";

type Props = { deals: Deal[]; thresholds: { good: number; warn: number }; loading?: boolean };

export function AwaitingDecision({ deals, thresholds, loading }: Props) {
  return (
    <Card title="Awaiting decision" description="Deals with an Advance verdict" testId="awaiting-decision">
      {loading ? <Skeleton height={120} /> : <DealLinks deals={deals} thresholds={thresholds} empty="No deals awaiting a decision." />}
    </Card>
  );
}
