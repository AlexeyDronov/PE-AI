import styles from "./Toast.module.css";

export function Toast({ message }: { message: string }) {
  return (
    <div role="status" className={styles.root}>
      {message}
    </div>
  );
}
