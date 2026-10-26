import { CompanyFlags, Scorecard } from "@/components/domain/deal";
import { VERDICT_TONE, type Verdict } from "@/components/domain/verdict";
import { Badge, ButtonLink, Card, KeyValueList } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./Teaser.module.css";
import type { ScreenedDeal } from "./types";

type Props = { deal: ScreenedDeal; thresholds: { good: number; warn: number } };

export function TeaserResult({ deal, thresholds }: Props) {
  const { financials: f, screening } = deal;
  const figures = [
    { label: "Revenue", value: fmt.money(f.revenue) },
    { label: "EBITDA", value: fmt.money(f.ebitda) },
    { label: "Revenue growth", value: fmt.pct(f.growth) },
    { label: "Recurring revenue", value: fmt.pct(f.recurring_pct) },
    { label: "Gross retention", value: fmt.pct(f.gross_retention) },
    { label: "Top customer", value: fmt.pct(f.top_customer_pct) },
    { label: "Cyclicality", value: f.cyclicality },
    { label: "Ask multiple", value: fmt.multiple(deal.ask_multiple) },
  ];
  return (
    <div className={styles.result} data-testid="teaser-result">
      <p className={styles.note}>
        <b>{deal.company.name}</b> ({deal.code_name}, {deal.segment.name}) was added to the pipeline. Check the extracted figures against the teaser.
      </p>
      <div className={styles.pair}>
        <Card title="Extracted figures" description="Read from the teaser for you to confirm" testId="teaser-figures">
          <KeyValueList items={figures} />
        </Card>
        <Card title="Verdict" testId="teaser-verdict">
          <div className={styles.verdict}>
            <Badge tone={VERDICT_TONE[screening.verdict as Verdict]}>{screening.verdict}</Badge>
            <span className={styles.score}>Score {fmt.int(screening.score)}</span>
          </div>
          {screening.gate_reason ? <p className={styles.reason}>{screening.gate_reason}</p> : null}
        </Card>
      </div>
      <Scorecard criteria={screening.criteria} thresholds={thresholds} />
      <CompanyFlags flags={deal.flags} />
      <div>
        <ButtonLink variant="primary" href={`/deals/${deal.id}`}>
          Open deal
        </ButtonLink>
      </div>
    </div>
  );
}
