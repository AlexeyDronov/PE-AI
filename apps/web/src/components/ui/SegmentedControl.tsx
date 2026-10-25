"use client";

import { type KeyboardEvent, useRef } from "react";
import styles from "./SegmentedControl.module.css";
import { useSlidingIndicator } from "./useSlidingIndicator";

export type SegmentedOption = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  testId?: string;
};

export function SegmentedControl({ label, value, onChange, options, testId = "segmented-control" }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const thumb = useSlidingIndicator(trackRef, value);

  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    buttons.current[options.indexOf(next)]?.focus();
  }

  return (
    <div ref={trackRef} role="group" aria-label={label} className={styles.root} data-testid={testId}>
      {thumb ? <span className={styles.thumb} style={{ left: thumb.left, width: thumb.width }} aria-hidden="true" /> : null}
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(el) => {
            buttons.current[index] = el;
          }}
          type="button"
          className={styles.option}
          aria-pressed={option.value === value}
          data-active={option.value === value}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
