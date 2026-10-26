import { Skeleton } from "@/components/ui";
import styles from "./loading.module.css";

/** Shown inside the shell the moment a link is clicked, until the next page is ready. */
export default function Loading() {
  return (
    <div className={styles.root} role="status" aria-label="Loading page" data-testid="page-loading">
      <Skeleton width={240} height={28} />
      <Skeleton width={360} height={16} />
      <div className={styles.strip}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={72} />
        ))}
      </div>
      <Skeleton height={280} />
    </div>
  );
}
