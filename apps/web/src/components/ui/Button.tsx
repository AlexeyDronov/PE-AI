"use client";

import Link from "next/link";
import { type ButtonHTMLAttributes, type ReactNode, useContext } from "react";
import { ReadOnlyContext } from "./ReadOnly";
import styles from "./Button.module.css";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  loading?: boolean;
  /** Starts a change or a paid job: disabled, with the reason as its tooltip, for view-only accounts. */
  writes?: boolean;
  /** "submit" only for a form's main action; everything else is a plain button. */
  type?: "button" | "submit";
  testId?: string;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  disabled,
  writes = false,
  type = "button",
  testId = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const readOnly = useContext(ReadOnlyContext);
  const locked = writes && readOnly !== null;
  const spinner = <span className={styles.spinner} aria-hidden="true" />;
  return (
    <button
      {...rest}
      type={type}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading || locked}
      title={locked ? readOnly : rest.title}
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
