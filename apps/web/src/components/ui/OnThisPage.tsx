"use client";

import { useEffect, useState } from "react";
import styles from "./OnThisPage.module.css";

export type OnThisPageItem = { id: string; label: string };

/** Anchor links to a page's sections; the section in view is marked when the browser can observe it. */
export function OnThisPage({ items, testId = "on-this-page" }: { items: OnThisPageItem[]; testId?: string }) {
  const [active, setActive] = useState<string | undefined>(undefined);
  const ids = items.map((item) => item.id).join(",");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const order = ids.split(",");
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        setActive(order.find((id) => visible.has(id)));
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    for (const id of order) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [ids]);

  return (
    <nav aria-label="On this page" className={styles.root} data-testid={testId}>
      <p className={styles.title}>On this page</p>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className={styles.link} aria-current={item.id === active ? "location" : undefined}>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
