import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  tabs?: ReactNode;
  testId?: string;
};

export function PageHeader({ title, description, actions, meta, tabs, testId = "page-header" }: Props) {
  return (
    <header className={styles.root} data-testid={testId}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
          {meta ? <div className={styles.meta}>{meta}</div> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {tabs ? <div className={styles.tabs}>{tabs}</div> : null}
    </header>
  );
}
