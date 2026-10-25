import { Card, Skeleton } from "@/components/ui";
import styles from "./DiligenceList.module.css";

export function DiligenceList({ questions, loading }: { questions: string[]; loading?: boolean }) {
  return (
    <Card testId="diligence-list">
      {loading ? (
        <Skeleton height={96} />
      ) : (
        <ol className={styles.list}>
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
      )}
    </Card>
  );
}
