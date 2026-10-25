import { Button, Card, SegmentedControl, Skeleton, Slider } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./AssumptionsPanel.module.css";
import type { LboAssumptions, LboCase, Overrides } from "./types";

type Lever = {
  key: keyof Overrides;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  current: (a: LboAssumptions) => number;
};

const LEVERS: Lever[] = [
  { key: "entry_multiple", label: "Entry EV / EBITDA", min: 6, max: 20, step: 0.5, format: (v) => fmt.multiple(v), current: (a) => a.entry_multiple },
  { key: "exit_multiple", label: "Exit EV / EBITDA", min: 6, max: 20, step: 0.5, format: (v) => fmt.multiple(v), current: (a) => a.exit_multiple },
  { key: "total_leverage", label: "Total leverage", min: 2, max: 7, step: 0.25, format: (v) => fmt.multiple(v, { dp: 2 }), current: (a) => a.total_leverage },
  { key: "growth_y1", label: "Revenue growth, year 1", min: 0, max: 0.4, step: 0.01, format: (v) => fmt.pct(v, { dp: 0 }), current: (a) => a.revenue_growth[0] ?? 0 },
  { key: "margin_change_bp", label: "Margin change per year", min: -200, max: 200, step: 25, format: (v) => (v >= 0 ? `+${fmt.int(v)}bp` : fmt.bp(v)), current: (a) => a.margin_change_bp },
  { key: "mgmt_rollover", label: "Management rollover", min: 0, max: 0.3, step: 0.05, format: (v) => fmt.pct(v, { dp: 0 }), current: (a) => a.mgmt_rollover },
];

const CASES = [
  { value: "down", label: "Downside" },
  { value: "base", label: "Base" },
  { value: "up", label: "Upside" },
];

type Props = {
  assumptions?: LboAssumptions;
  overrides: Overrides;
  scenario: LboCase;
  onScenarioChange: (value: LboCase) => void;
  onOverride: (key: keyof Overrides, value: number) => void;
  onReset: () => void;
};

const isCase = (v: string): v is LboCase => CASES.some((c) => c.value === v);

export function AssumptionsPanel({ assumptions, overrides, scenario, onScenarioChange, onOverride, onReset }: Props) {
  return (
    <Card title="Assumptions" description="Blue figures are editable inputs" actions={<Button variant="ghost" size="sm" onClick={onReset}>Reset</Button>} testId="assumptions-panel">
      <div className={styles.body}>
      <SegmentedControl label="Case" value={scenario} options={CASES} onChange={(v) => isCase(v) && onScenarioChange(v)} />
      {!assumptions && LEVERS.map((lever) => <Skeleton key={lever.key} height={36} />)}
      {assumptions && LEVERS.map((lever) => {
        const value = overrides[lever.key] ?? lever.current(assumptions);
        return (
          <Slider
            key={lever.key}
            label={lever.label}
            value={value}
            min={lever.min}
            max={lever.max}
            step={lever.step}
            format={lever.format}
            onChange={(v) => onOverride(lever.key, v)}
          />
        );
      })}
      </div>
    </Card>
  );
}
