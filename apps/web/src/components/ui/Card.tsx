import type { ReactNode } from "react";
import styles from "./Card.module.css";

type Props = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  flush?: boolean;
  testId?: string;
  children: ReactNode;
};

export function Card({ title, description, actions, flush, testId = "card", children }: Props) {
  return (
    <div className={styles.root} data-flush={flush ? "true" : undefined} data-testid={testId}>
      {title || actions ? (
        <div className={styles.header}>
          <div>
            {title ? <h3 className={styles.title}>{title}</h3> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      ) : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
