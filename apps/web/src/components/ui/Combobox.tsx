"use client";

import { useId, useState } from "react";
import styles from "./Combobox.module.css";

export type ComboOption = { value: string; label: string };
type Props = { label: string; options: ComboOption[]; value: string; onChange: (value: string) => void };

export function Combobox({ label, options, value, onChange }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState(options.find((o) => o.value === value)?.label ?? "");
  const [open, setOpen] = useState(false);
  const shown = options.filter((o) => o.label.toLowerCase().includes(text.toLowerCase()));
  return (
    <div className={styles.root}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <input
        id={id}
        className={styles.input}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className={styles.list}>
          {shown.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={styles.option}
              onClick={() => {
                onChange(o.value);
                setText(o.label);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
