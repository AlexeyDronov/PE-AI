import { Card, HeadroomMeter, KeyValueList } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./CapitalStructure.module.css";
import type { PlatformDetail } from "./types";

type Props = { facility: PlatformDetail["facility"]; threshold: number };

export function CapitalStructure({ facility, threshold }: Props) {
  return (
    <Card title="Debt facility" testId="capital-structure">
      <KeyValueList
        items={[
          { label: "Facility type", value: facility.type },
          { label: "Pricing", value: facility.pricing },
          { label: "Covenant", value: facility.covenant },
          { label: "Test level", value: fmt.multiple(facility.test_level) },
          { label: "Actual", value: fmt.multiple(facility.actual) },
          { label: "Interest cover", value: fmt.multiple(facility.interest_cover) },
          { label: "Cov-lite", value: facility.cov_lite ? "Yes" : "No" },
        ]}
      />
      <div data-layout="full" className={styles.headroom}>
        <span className={styles.headroomLabel}>Headroom</span>
        <HeadroomMeter label="Covenant headroom" value={facility.headroom} threshold={threshold} />
      </div>
    </Card>
  );
}
