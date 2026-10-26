"use client";

import { type ChangeEvent, type ReactNode, useContext } from "react";
import { ReadOnlyContext } from "./ReadOnly";
import styles from "./Button.module.css";
import fileStyles from "./FileButton.module.css";

type Props = {
  /** Visible label, also the accessible name of the native file input. */
  children: ReactNode;
  accept?: string;
  onFile: (file: File) => void;
  /** Name of the file already chosen, shown beside the button. */
  fileName?: string;
  disabled?: boolean;
  /** Starts a change or a paid job: disabled for view-only accounts. */
  writes?: boolean;
  testId?: string;
};

/** A secondary button that opens the native file picker; the input itself is visually hidden. */
export function FileButton({ children, accept, onFile, fileName, disabled, writes = false, testId = "file-button" }: Props) {
  const readOnly = useContext(ReadOnlyContext);
  const locked = writes && readOnly !== null;
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (file) onFile(file);
    input.value = "";
  };
  return (
    <span className={fileStyles.root} data-testid={testId}>
      <label
        className={`${styles.root} ${fileStyles.label}`}
        data-variant="secondary"
        data-size="md"
        data-disabled={disabled || locked ? "true" : undefined}
        title={locked ? readOnly : undefined}
      >
        <input className={fileStyles.input} type="file" accept={accept} onChange={change} disabled={disabled || locked} />
        <span className={styles.label}>{children}</span>
      </label>
      {fileName ? <span className={fileStyles.name}>{fileName}</span> : null}
    </span>
  );
}
