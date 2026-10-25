import { Card, KeyValueList } from "@/components/ui";
import { fmt } from "@/lib/format";
import type { PlatformDetail } from "./types";

export function ExitPlanCard({ plan, moic }: { plan: PlatformDetail["exit_plan"]; moic: number }) {
  return (
    <Card testId="exit-plan">
      <KeyValueList
        items={[
          { label: "Route", value: plan.route },
          { label: "Likely buyers", value: plan.buyers },
          { label: "Window", value: plan.window },
          { label: "Current MOIC", value: fmt.multiple(moic, { dp: 2 }) },
        ]}
      />
    </Card>
  );
}
