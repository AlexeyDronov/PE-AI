import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  tabs?: ReactNode;
  testId?: string;
  /** Only the page's own header is the h1; a header shown inside another page (the gallery) uses 2. */
  headingLevel?: 1 | 2;
};

export function PageHeader({ title, description, actions, meta, tabs, testId = "page-header", headingLevel = 1 }: Props) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <header className={styles.root} data-testid={testId}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <Heading className={styles.title}>{title}</Heading>
          {description ? <p className={styles.description}>{description}</p> : null}
          {meta ? <div className={styles.meta}>{meta}</div> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {tabs ? <div className={styles.tabs}>{tabs}</div> : null}
    </header>
  );
}
