import styles from "./SkipLink.module.css";

/** Where the skip link lands: the page's single `main` landmark. */
export const MAIN_ID = "main-content";

/** First tab stop on every page; hidden until focused, then jumps past the navigation. */
export function SkipLink() {
  return (
    <a href={`#${MAIN_ID}`} className={styles.root} data-testid="skip-link">
      Skip to main content
    </a>
  );
}
