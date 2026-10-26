"use client";

import { useId } from "react";
import styles from "./Select.module.css";

export type SelectOption = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  help?: string;
  testId?: string;
};

/** A labelled native select. */
export function Select({ label, value, onChange, options, disabled, help, testId = "select" }: Props) {
  const id = useId();
  return (
    <div className={styles.root} data-testid={testId}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select id={id} className={styles.control} value={value} disabled={disabled} aria-describedby={help ? `${id}-help` : undefined} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help ? (
        <p id={`${id}-help`} className={styles.help}>
          {help}
        </p>
      ) : null}
    </div>
  );
}
