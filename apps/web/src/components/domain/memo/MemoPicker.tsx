import { Button, Checkbox, Select, type SelectOption } from "@/components/ui";
import styles from "./Memo.module.css";

export type PickerSection = { key: string; label: string; description: string };

type Props = {
  sections: PickerSection[];
  selected: string[];
  onToggle: (key: string, checked: boolean) => void;
  scenarioId: string;
  scenarios: SelectOption[];
  onScenarioChange: (id: string) => void;
  onDraft: () => void;
  busy: boolean;
};

/** Which sections and scenario to draft the IC memo from. */
export function MemoPicker({ sections, selected, onToggle, scenarioId, scenarios, onScenarioChange, onDraft, busy }: Props) {
  return (
    <div className={styles.picker} data-testid="memo-picker">
      <div className={styles.checks}>
        {sections.map((s) => (
          <Checkbox key={s.key} label={s.label} hint={s.description} checked={selected.includes(s.key)} onChange={(c) => onToggle(s.key, c)} />
        ))}
      </div>
      <Select label="Scenario" value={scenarioId} onChange={onScenarioChange} options={[{ value: "", label: "Base case" }, ...scenarios]} />
      <Button variant="primary" writes disabled={busy || !selected.length} onClick={onDraft}>
        Draft memo
      </Button>
    </div>
  );
}
