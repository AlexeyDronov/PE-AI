import { Briefcase, Globe, House, List, LogOut, Plus, Search, Shield, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Sidebar.module.css";

const ICONS = {
  home: House,
  globe: Globe,
  search: Search,
  list: List,
  plus: Plus,
  briefcase: Briefcase,
  shield: Shield,
  logout: LogOut,
  trending: TrendingUp,
} satisfies Record<string, LucideIcon>;

export type SidebarIcon = keyof typeof ICONS;
export type SidebarItem = { href: string; label: string; icon: SidebarIcon; count?: number };
export type SidebarGroup = { label?: string; items: SidebarItem[] };

type Props = {
  fund: { name: string; detail: string };
  groups: SidebarGroup[];
  activeHref: string;
  footer?: ReactNode;
  /** Called when a link is hovered or focused, before it is followed. */
  onIntent?: (href: string) => void;
  testId?: string;
};

function isActive(href: string, activeHref: string): boolean {
  return href === "/" ? activeHref === "/" : activeHref === href || activeHref.startsWith(`${href}/`);
}

export function Sidebar({ fund, groups, activeHref, footer, onIntent, testId = "sidebar" }: Props) {
  return (
    <aside className={styles.root} data-testid={testId}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          {fund.name.charAt(0)}
        </span>
        <div className={styles.brandText}>
          <b>{fund.name}</b>
          <span>{fund.detail}</span>
        </div>
      </div>
      <nav aria-label="Main" className={styles.nav}>
        {groups.map((group, index) => (
          <div key={group.label ?? index} className={styles.group}>
            {group.label ? <p className={styles.eyebrow}>{group.label}</p> : null}
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.item}
                  aria-current={isActive(item.href, activeHref) ? "page" : undefined}
                  onMouseEnter={() => onIntent?.(item.href)}
                  onFocus={() => onIntent?.(item.href)}
                >
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span className={styles.itemLabel}>{item.label}</span>
                  {item.count !== undefined ? <span className={styles.count}>{item.count}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </aside>
  );
}
