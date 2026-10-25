import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  loading?: boolean;
  testId?: string;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  disabled,
  testId = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const spinner = <span className={styles.spinner} aria-hidden="true" />;
  return (
    <button
      {...rest}
      type="button"
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      data-testid={testId}
    >
      {loading && !icon ? <span className={styles.overlay}>{spinner}</span> : null}
      {icon ? <span className={styles.icon}>{loading ? spinner : icon}</span> : null}
      <span className={styles.label}>{children}</span>
    </button>
  );
}

/** A link styled as a button, for navigation actions. */
export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  icon,
  testId = "button-link",
  className,
  children,
}: Pick<ButtonProps, "variant" | "size" | "icon" | "testId" | "className" | "children"> & { href: string }) {
  return (
    <Link href={href} className={[styles.root, className].filter(Boolean).join(" ")} data-variant={variant} data-size={size} data-testid={testId}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <span className={styles.label}>{children}</span>
    </Link>
  );
}
