import { AlertItem, Card, EmptyState, toSeverity } from "@/components/ui";
import type { PlatformDetail } from "./types";

export function PlatformAlerts({ alerts }: { alerts: PlatformDetail["alerts"] }) {
  return (
    <Card flush testId="platform-alerts">
      {alerts.length === 0 ? (
        <EmptyState title="No open alerts" body="Nothing needs attention at this platform." />
      ) : (
        alerts.map((a) => <AlertItem key={a.id} severity={toSeverity(a.severity)} label={a.label} title={a.text} action={a.action} />)
      )}
    </Card>
  );
}
