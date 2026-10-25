import { jobKindLabel, JOB_STATUS_TONE } from "@/components/domain/jobs";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui";
import type { Job } from "@/lib/api/types";
import styles from "./ActivityFeed.module.css";

type Props = { jobs: Job[]; loading?: boolean };

export function ActivityFeed({ jobs, loading }: Props) {
  return (
    <Card flush testId="activity-feed">
      {loading ? (
        <Skeleton height={96} />
      ) : jobs.length === 0 ? (
        <EmptyState title="No Copilot activity yet" body="Research and screening runs appear here as they happen." />
      ) : (
        <ul className={styles.list}>
          {jobs.map((job) => (
            <li key={job.id} className={styles.job}>
              <b>{jobKindLabel(job.kind)}</b>
              <span className={styles.message}>{job.progress.at(-1)?.message ?? "Starting"}</span>
              <Badge tone={JOB_STATUS_TONE[job.status]}>{job.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
