import { FindingsTable } from "./FindingsTable";
import styles from "./Research.module.css";
import { SourceList } from "./SourceList";
import type { ReportDetailData } from "./types";

export function ReportDetail({ report }: { report: ReportDetailData }) {
  return (
    <div className={styles.detail} data-testid="report-detail">
      <div>
        <h3 className={styles.heading}>{report.question}</h3>
        <p className={styles.summary}>{report.summary}</p>
      </div>
      <div>
        <h3 className={styles.heading}>Findings</h3>
        <FindingsTable findings={report.findings} />
      </div>
      <div>
        <h3 className={styles.heading}>Sources</h3>
        <SourceList sources={report.sources} />
      </div>
    </div>
  );
}
