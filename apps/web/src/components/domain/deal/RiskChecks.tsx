import { AlertItem, Card, type Severity, Skeleton } from "@/components/ui";
import type { RiskCheckItem } from "./types";

const STATUS: Record<RiskCheckItem["status"], { severity: Severity; label: string }> = {
  clear: { severity: "good", label: "Clear" },
  watch: { severity: "warn", label: "Watch" },
  flag: { severity: "bad", label: "Flag" },
};

export function RiskChecks({ checks, loading }: { checks: RiskCheckItem[]; loading?: boolean }) {
  return (
    <Card flush title="Standard checks" testId="risk-checks">
      {loading ? (
        <Skeleton height={64} />
      ) : (
        checks.map((check) => <AlertItem key={check.key} severity={STATUS[check.status].severity} label={STATUS[check.status].label} title={check.label} body={check.detail} />)
      )}
    </Card>
  );
}
