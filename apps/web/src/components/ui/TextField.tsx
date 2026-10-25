"use client";

import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, useId, useLayoutEffect, useRef } from "react";
import styles from "./TextField.module.css";

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  error?: string;
  testId?: string;
};

type Wired = { id: string; "aria-describedby": string | undefined; "aria-invalid": true | undefined };

function Field({ label, id, help, error, testId, children }: Pick<FieldProps, "label" | "help" | "error"> & { id: string; testId: string; children: ReactNode }) {
  return (
    <div className={styles.root} data-testid={testId}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className={styles.help}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

function useWiring(help: string | undefined, error: string | undefined): Wired {
  const id = useId();
  return {
    id,
    "aria-describedby": error ? `${id}-error` : help ? `${id}-help` : undefined,
    "aria-invalid": error ? true : undefined,
  };
}

export function TextField({
  label,
  value,
  onChange,
  help,
  error,
  testId = "text-field",
  ...rest
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">) {
  const wired = useWiring(help, error);
  return (
    <Field label={label} id={wired.id} help={help} error={error} testId={testId}>
      <input {...rest} {...wired} className={styles.control} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  help,
  error,
  testId = "textarea",
  ...rest
}: FieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "id">) {
  const wired = useWiring(help, error);
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <Field label={label} id={wired.id} help={help} error={error} testId={testId}>
      <textarea
        rows={3}
        {...rest}
        {...wired}
        ref={ref}
        className={`${styles.control} ${styles.area}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
