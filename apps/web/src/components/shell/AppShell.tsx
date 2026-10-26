"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { breadcrumbFor, NAVIGATION, PAGE_DATA } from "@/app/navigation";
import { Badge, Breadcrumb, Button, type Crumb, MAIN_ID, Sidebar, SkipLink } from "@/components/ui";
import { usePrefetchResource, useResource } from "@/hooks/useResource";
import { clearSession, goTo } from "@/lib/api/session";
import { fmt } from "@/lib/format";
import { useSession } from "./AuthGate";
import { BreadcrumbSetter } from "./BreadcrumbContext";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./AppShell.module.css";

export function AppShell({ children, breadcrumb }: { children: ReactNode; breadcrumb?: Crumb[] }) {
  const pathname = usePathname();
  const fund = useResource("funds").data?.items[0];
  const name = fund?.name ?? "Harrowgate";
  const committed = fund ? `${fmt.money(fund.committed)} committed` : "Deal Copilot";
  const session = useSession();
  const prefetch = usePrefetchResource();
  const [override, setOverride] = useState<Crumb[] | undefined>(undefined);
  const crumbs = breadcrumb ?? override ?? breadcrumbFor(pathname);

  return (
    <div className={styles.root} data-testid="app-shell">
      <SkipLink />
      <Sidebar
        fund={{ name, detail: committed }}
        groups={NAVIGATION}
        activeHref={pathname}
        onIntent={(href) => PAGE_DATA[href]?.forEach(([key, params]) => prefetch(key, params))}
      />
      <div className={styles.column}>
        <header className={styles.header}>
          {crumbs.length ? <Breadcrumb items={crumbs} /> : <span />}
          <div className={styles.actions}>
            {session?.auth_enabled ? (
              <span className={styles.account}>
                {session.username}
                {session.role === "guest" ? <Badge>View only</Badge> : null}
              </span>
            ) : null}
            <ThemeToggle />
            {session?.auth_enabled ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearSession();
                  goTo("/login");
                }}
              >
                Sign out
              </Button>
            ) : null}
          </div>
        </header>
        <main id={MAIN_ID} tabIndex={-1} className={styles.main}>
          <BreadcrumbSetter.Provider value={setOverride}>{children}</BreadcrumbSetter.Provider>
        </main>
      </div>
    </div>
  );
}
