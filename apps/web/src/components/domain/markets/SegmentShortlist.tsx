import Link from "next/link";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import styles from "./SegmentShortlist.module.css";
import type { Segment } from "./types";

type Props = { segments: Segment[]; loading?: boolean };

/** Segments in the order given (the API ranks them by attractiveness). */
export function SegmentShortlist({ segments, loading }: Props) {
  return (
    <Card title="Shortlist" description="Ranked by sponsor attractiveness" testId="segment-shortlist">
      {loading ? (
        <Skeleton height={160} />
      ) : segments.length === 0 ? (
        <EmptyState title="No segments yet" />
      ) : (
        <ol className={styles.list}>
          {segments.map((s) => (
            <li key={s.id}>
              <Link href={`/markets/${s.id}`} className={styles.item}>
                <span>{s.short}</span>
                <span className={styles.score}>
                  {s.attractiveness} / {s.attractiveness_max}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
