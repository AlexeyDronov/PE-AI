import { Button, Card, Select, type SelectOption, Textarea } from "@/components/ui";
import styles from "./Research.module.css";

type Props = {
  question: string;
  onQuestionChange: (value: string) => void;
  segmentId: string;
  onSegmentChange: (value: string) => void;
  segments: SelectOption[];
  onSubmit: () => void;
  busy?: boolean;
  error?: string;
};

export function ResearchForm({ question, onQuestionChange, segmentId, onSegmentChange, segments, onSubmit, busy, error }: Props) {
  return (
    <Card description="Ask the Copilot a question; it searches, reads and cites sources" testId="research-form">
      <div className={styles.form}>
        <Textarea label="Research question" value={question} onChange={onQuestionChange} error={error} />
        <Select label="Segment" value={segmentId} onChange={onSegmentChange} options={[{ value: "", label: "All segments" }, ...segments]} />
        <div className={styles.actions}>
          <Button variant="primary" loading={busy} disabled={!question.trim() || busy} onClick={onSubmit}>
            Run research
          </Button>
        </div>
      </div>
    </Card>
  );
}
