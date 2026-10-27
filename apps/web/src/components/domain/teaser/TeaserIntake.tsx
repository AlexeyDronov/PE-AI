import { useState } from "react";
import { useApiContext } from "@/lib/api/provider";
import { authHeader } from "@/lib/api/session";
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
  const [loadError, setLoadError] = useState("");
  const { baseUrl } = useApiContext();
  const load = (file: File) => {
    setLoadError("");
    if (!/\.(txt|md)$/i.test(file.name)) {
      const form = new FormData();
      form.append("file", file);
      void fetch(`${baseUrl}/api/extract-text`, { method: "POST", body: form, headers: authHeader() })
        .then(async (res) => {
          const body = (await res.json().catch(() => null)) as { text?: string; error?: { message?: string } } | null;
          if (!res.ok) throw new Error(body?.error?.message ?? res.statusText);
          onChange(body?.text ?? "");
          setFileName(file.name);
        })
        .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Couldn't read that file."));
      return;
    }
    void file.text().then((t) => {
      onChange(t);
      setFileName(file.name);
    });
  };

  return (
    <Card description="Paste the adviser's teaser or upload a PDF, Word, PowerPoint or text file" testId="teaser-intake">
      <div className={styles.form}>
        <Textarea label="Teaser text" rows={10} value={value} onChange={onChange} help={hintFor(length)} error={error ?? (loadError || undefined)} />
        <div className={styles.actions}>
          <Button variant="primary" disabled={!valid} loading={busy} onClick={onSubmit}>
            Extract and screen
          </Button>
          <FileButton accept=".pdf,.docx,.pptx,.txt,.md" onFile={load} fileName={fileName} disabled={busy}>
            Upload a document
          </FileButton>
        </div>
      </div>
    </Card>
  );
}
