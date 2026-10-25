"use client";

import * as RadixSlider from "@radix-ui/react-slider";
import { useId, useState } from "react";
import styles from "./Slider.module.css";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: string;
  disabled?: boolean;
  testId?: string;
};

export function Slider({ label, value, min, max, step, onChange, format = String, hint, disabled, testId = "slider" }: Props) {
  const labelId = useId();
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    const parsed = Number(draft);
    if (draft !== null && draft.trim() !== "" && Number.isFinite(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
    setDraft(null);
  }

  return (
    <div className={styles.root} data-testid={testId}>
      <div className={styles.top}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {draft === null ? (
          <button
            type="button"
            className={styles.value}
            data-testid="slider-value"
            disabled={disabled}
            aria-label={`Edit ${label}`}
            onClick={() => setDraft(String(value))}
          >
            {format(value)}
          </button>
        ) : (
          <input
            className={styles.edit}
            type="number"
            min={min}
            max={max}
            step={step}
            value={draft}
            aria-label={label}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") setDraft(null);
            }}
          />
        )}
      </div>
      <RadixSlider.Root
        className={styles.track}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([next]) => {
          if (next !== undefined) onChange(next);
        }}
      >
        <RadixSlider.Track className={styles.rail}>
          <RadixSlider.Range className={styles.range} />
        </RadixSlider.Track>
        <RadixSlider.Thumb className={styles.thumb} aria-label={label} aria-valuetext={format(value)} />
      </RadixSlider.Root>
      {hint ? <small className={styles.hint}>{hint}</small> : null}
    </div>
  );
}
