import { DealLinks } from "@/components/domain/pipeline";
import { Card, StatStrip } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./SegmentProfile.module.css";
import type { SegmentDetail } from "./types";

export function SegmentProfile({ segment }: { segment: SegmentDetail }) {
  const stats = [
    { label: "Market size", value: fmt.bn(segment.market_size, { dp: 1 }) },
    { label: "CAGR", value: fmt.pct(segment.cagr) },
    { label: "Avg margin", value: fmt.pct(segment.avg_margin) },
    { label: "Median EV/EBITDA", value: fmt.multiple(segment.median_multiple) },
    { label: "Add-on multiple", value: fmt.multiple(segment.addon_multiple) },
  ];
  return (
    <div className={styles.root} data-testid="segment-profile">
      <StatStrip items={stats} count={5} />
      <div className={styles.columns}>
        <Card title="House view" testId="segment-view">
          <p className={styles.prose}>{segment.view}</p>
        </Card>
        <Card title="White space" testId="segment-white-space">
          <p className={styles.prose}>{segment.white_space}</p>
        </Card>
      </div>
      <Card title="Matching deals" description="Pipeline deals in this segment" testId="matching-deals">
        <DealLinks deals={segment.matching_deals} empty="No pipeline deals in this segment." />
      </Card>
    </div>
  );
}
