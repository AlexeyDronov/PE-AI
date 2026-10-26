import { useState } from "react";
import { Button, Card, FileButton, Textarea } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./Teaser.module.css";

export const TEASER_MIN_CHARS = 200;
export const TEASER_MAX_CHARS = 36_000;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  error?: string;
};

function hintFor(length: number): string {
  if (length > TEASER_MAX_CHARS) return `Too long: keep it under ${fmt.int(TEASER_MAX_CHARS)} characters (now ${fmt.int(length)}).`;
  if (length < TEASER_MIN_CHARS) return `Paste at least ${TEASER_MIN_CHARS} characters of the teaser (now ${fmt.int(length)}). Up to ${fmt.int(TEASER_MAX_CHARS)} are read.`;
  return `${fmt.int(length)} characters. Up to ${fmt.int(TEASER_MAX_CHARS)} are read.`;
}

export function TeaserIntake({ value, onChange, onSubmit, busy, error }: Props) {
  const length = value.trim().length;
  const valid = length >= TEASER_MIN_CHARS && length <= TEASER_MAX_CHARS;

  const [fileName, setFileName] = useState("");
  const load = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  return (
    <Card description="Paste the adviser's teaser or upload it as text" testId="teaser-intake">
      <div className={styles.form}>
        <Textarea label="Teaser text" rows={10} value={value} onChange={onChange} help={hintFor(length)} error={error} />
        <div className={styles.actions}>
          <Button variant="primary" disabled={!valid} loading={busy} onClick={onSubmit}>
            Extract and screen
          </Button>
          <FileButton accept=".txt,.md,text/plain,text/markdown" onFile={load} fileName={fileName} disabled={busy}>
            Upload .txt or .md
          </FileButton>
        </div>
      </div>
    </Card>
  );
}
