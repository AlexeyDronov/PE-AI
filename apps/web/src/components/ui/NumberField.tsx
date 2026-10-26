"use client";

import { useId, useState } from "react";
import styles from "./NumberField.module.css";

type Props = { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number };

export function NumberField({ label, value, onChange, step, min, max }: Props) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className={styles.root}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <input
        id={id}
        className={styles.input}
        type="number"
        value={draft ?? (Number.isFinite(value) ? String(value) : "")}
        onBlur={() => setDraft(null)}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}
