import { AlertItem, Card, EmptyState, Skeleton, toSeverity } from "@/components/ui";
import type { Alert } from "./types";

type Props = { alerts: Alert[]; loading?: boolean };

/** Portfolio alerts needing a decision (bad) or a look (warn), most serious first. */
export function AttentionAlerts({ alerts, loading }: Props) {
  const ranked = [...alerts.filter((a) => a.severity === "bad"), ...alerts.filter((a) => a.severity === "warn")];
  return (
    <Card flush title="Portfolio alerts" description="Action first, then Watch" testId="attention-alerts">
      {loading ? (
        <Skeleton height={120} />
      ) : ranked.length === 0 ? (
        <EmptyState title="Nothing needs attention" body="No portfolio alerts are open." />
      ) : (
        ranked.map((a) => <AlertItem key={a.id} severity={toSeverity(a.severity)} label={a.label} title={a.company.name} body={a.text} action={a.action} />)
      )}
    </Card>
  );
}
