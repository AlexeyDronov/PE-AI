"use client";

import { Chart } from "@/components/charts/Chart";
import { stackedBarOption } from "@/components/charts/options";
import { useChartTheme } from "@/components/charts/theme";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./DistributionWaterfall.module.css";
import type { WaterfallTier } from "./types";

type Props = { tiers: WaterfallTier[]; prefRate: number; carry: number; gpCarry: number; lpTotal: number; loading?: boolean };

export function DistributionWaterfall({ tiers, prefRate, carry, gpCarry, lpTotal, loading }: Props) {
  const theme = useChartTheme();
  const option = stackedBarOption(
    {
      categories: tiers.map((t) => t.label),
      series: [
        { name: "LP", values: tiers.map((t) => t.lp) },
        { name: "GP", values: tiers.map((t) => t.gp) },
      ],
      orientation: "vertical",
      valueFormat: fmt.money,
      unit: "money",
    },
    theme,
  );
  return (
    <Card
      description={`On a hypothetical liquidation at NAV · ${fmt.pct(prefRate, { dp: 0 })} preferred return · ${fmt.pct(carry, { dp: 0 })} carry`}
      testId="distribution-waterfall"
    >
      <Chart
        label="Distribution waterfall"
        option={option}
        loading={loading}
        table={{
          columns: [
            { key: "tier", header: "Tier", render: (t) => t.label },
            { key: "lp", header: "LP", align: "right", render: (t) => fmt.money(t.lp) },
            { key: "gp", header: "GP", align: "right", render: (t) => fmt.money(t.gp) },
          ],
          rows: tiers,
          getRowId: (t) => t.label,
        }}
      />
      <p className={styles.caption}>
        GP carry {fmt.money(gpCarry)} · LP total {fmt.money(lpTotal)}
      </p>
      {gpCarry === 0 ? <p className={styles.caption}>No carry earned yet: the {fmt.pct(prefRate, { dp: 0 })} preferred return is not yet covered.</p> : null}
    </Card>
  );
}
