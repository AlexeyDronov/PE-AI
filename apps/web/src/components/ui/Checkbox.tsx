import { useId } from "react";
import styles from "./Checkbox.module.css";

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
  testId?: string;
};

/** A labelled native checkbox with an optional hint beneath the label. */
export function Checkbox({ label, checked, onChange, hint, disabled, testId = "checkbox" }: Props) {
  const id = useId();
  return (
    <div className={styles.root} data-testid={testId}>
      <input
        id={id}
        className={styles.control}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className={styles.text}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className={styles.hint}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
