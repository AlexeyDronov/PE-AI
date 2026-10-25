import Link from "next/link";
import { VERDICT_TONE } from "@/components/domain/verdict";
import { Badge, EmptyState, ScoreBar } from "@/components/ui";
import styles from "./DealLinks.module.css";
import type { Deal } from "./types";

type Props = { deals: Deal[]; thresholds?: { good: number; warn: number }; empty: string };

/** Deals as links to their overview, each with a verdict badge and, given thresholds, a score bar. */
export function DealLinks({ deals, thresholds, empty }: Props) {
  if (deals.length === 0) return <EmptyState title={empty} />;
  return (
    <ul className={styles.list}>
      {deals.map((d) => (
        <li key={d.id} className={styles.item}>
          <Link href={`/deals/${d.id}`}>{d.company.name}</Link>
          {thresholds ? <ScoreBar value={d.screening.score} label={`${d.company.name} score`} thresholds={thresholds} /> : null}
          <Badge tone={VERDICT_TONE[d.screening.verdict]}>{d.screening.verdict}</Badge>
        </li>
      ))}
    </ul>
  );
}
