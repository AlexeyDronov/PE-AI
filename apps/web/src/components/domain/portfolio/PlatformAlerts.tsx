import { AlertItem, Card, EmptyState, type Severity } from "@/components/ui";
import type { PlatformDetail } from "./types";

const SEVERITIES: readonly string[] = ["bad", "warn", "good", "info", "neutral"];
const severity = (value: string): Severity => (SEVERITIES.includes(value) ? (value as Severity) : "neutral");

export function PlatformAlerts({ alerts }: { alerts: PlatformDetail["alerts"] }) {
  return (
    <Card flush testId="platform-alerts">
      {alerts.length === 0 ? (
        <EmptyState title="No open alerts" body="Nothing needs attention at this platform." />
      ) : (
        alerts.map((a) => <AlertItem key={a.id} severity={severity(a.severity)} label={a.label} title={a.text} action={a.action} />)
      )}
    </Card>
  );
}
