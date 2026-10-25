import { AlertItem, Card, EmptyState, type Severity, Skeleton } from "@/components/ui";
import type { CompanyFlagItem } from "./types";

const HIGH = { severity: "bad", label: "High" } as const;
const MEDIUM = { severity: "warn", label: "Medium" } as const;
const LOW = { severity: "neutral", label: "Low" } as const;

function levelOf(severity: string): { severity: Severity; label: string } {
  return severity === "h" ? HIGH : severity === "m" ? MEDIUM : LOW;
}

export function CompanyFlags({ flags, loading }: { flags: CompanyFlagItem[]; loading?: boolean }) {
  return (
    <Card flush title="Company flags" description="Specific to this business, each with a mitigant" testId="company-flags">
      {loading ? (
        <Skeleton height={64} />
      ) : flags.length === 0 ? (
        <EmptyState title="No company flags" />
      ) : (
        flags.map((flag) => {
          const level = levelOf(flag.severity);
          return <AlertItem key={flag.id} severity={level.severity} label={level.label} title={flag.text} action={flag.mitigant} />;
        })
      )}
    </Card>
  );
}
