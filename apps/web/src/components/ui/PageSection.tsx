import type { ReactNode } from "react";
import styles from "./PageSection.module.css";

type Props = {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  testId?: string;
  children: ReactNode;
};

export function PageSection({ id, title, description, actions, testId = "page-section", children }: Props) {
  const titleId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={titleId} className={styles.root} data-testid={testId}>
      <div className={styles.header}>
        <div>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
