"use client";

import Link from "next/link";
import { useRef } from "react";
import styles from "./Tabs.module.css";
import { useSlidingIndicator } from "./useSlidingIndicator";

export type TabItem = { value: string; label: string; href?: string };

type Props = {
  label: string;
  value: string;
  tabs: TabItem[];
  onChange?: (value: string) => void;
  testId?: string;
};

export function Tabs({ label, value, tabs, onChange, testId = "tabs" }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const underline = useSlidingIndicator(listRef, value);

  return (
    <div ref={listRef} role="tablist" aria-label={label} className={styles.root} data-testid={testId}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        const common = {
          role: "tab",
          className: styles.tab,
          "aria-selected": selected,
          "data-active": selected,
        } as const;
        return tab.href ? (
          <Link key={tab.value} href={tab.href} {...common}>
            {tab.label}
          </Link>
        ) : (
          <button key={tab.value} type="button" onClick={() => onChange?.(tab.value)} {...common}>
            {tab.label}
          </button>
        );
      })}
      {underline ? <span className={styles.underline} style={{ left: underline.left, width: underline.width }} aria-hidden="true" /> : null}
    </div>
  );
}
