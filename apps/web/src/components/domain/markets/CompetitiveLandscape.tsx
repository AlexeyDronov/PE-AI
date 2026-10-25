import Link from "next/link";
import { Badge, Card, type Column, DataTable, EmptyState } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./CompetitiveLandscape.module.css";
import type { Player, Transaction } from "./types";

const COLUMNS: Column<Transaction>[] = [
  { key: "date", header: "Date", nowrap: true, render: (t) => fmt.date(t.date), sortValue: (t) => t.date },
  { key: "target", header: "Target", render: (t) => t.target, sortValue: (t) => t.target },
  { key: "acquirer", header: "Acquirer", render: (t) => t.acquirer, sortValue: (t) => t.acquirer },
  { key: "ev", header: "EV", align: "right", render: (t) => fmt.money(t.ev), sortValue: (t) => t.ev },
  { key: "multiple", header: "EV/EBITDA", align: "right", render: (t) => fmt.multiple(t.ev_ebitda), sortValue: (t) => t.ev_ebitda },
  { key: "route", header: "Route", render: (t) => t.route, sortValue: (t) => t.route },
];

const HREF: Record<string, (id: string) => string> = { portfolio: (id) => `/portfolio/${id}`, pipeline: (id) => `/deals/${id}` };

export function CompetitiveLandscape({ transactions, players }: { transactions: Transaction[]; players: Player[] }) {
  return (
    <div className={styles.root} data-testid="competitive-landscape">
      <Card flush title="Recent transactions" testId="segment-transactions">
        <DataTable label="Recent transactions" columns={COLUMNS} rows={transactions} getRowId={(t) => `${t.date}-${t.target}`} empty="No recent transactions." />
      </Card>
      <Card title="Known players" testId="segment-players">
        {players.length === 0 ? (
          <EmptyState title="No known players" />
        ) : (
          <ul className={styles.list}>
            {players.map((p) => {
              const href = HREF[p.kind]?.(p.id);
              return (
                <li key={p.id} className={styles.item}>
                  {href ? <Link href={href}>{p.name}</Link> : <span>{p.name}</span>}
                  <Badge tone={p.kind === "portfolio" ? "accent" : "neutral"}>{p.kind}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
