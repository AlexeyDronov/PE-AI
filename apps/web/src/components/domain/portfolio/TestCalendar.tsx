import { Card, EmptyState } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./TestCalendar.module.css";
import type { Facility } from "./types";

/** Facilities grouped under their next test date, earliest first. */
export function TestCalendar({ facilities }: { facilities: Facility[] }) {
  const dates = [...new Set(facilities.map((f) => f.next_test_date))].sort();
  return (
    <Card testId="test-calendar">
      {dates.length === 0 ? (
        <EmptyState title="No tests scheduled" />
      ) : (
        dates.map((date) => (
          <div key={date} className={styles.group}>
            <h3 className={styles.date}>{fmt.date(date)}</h3>
            <ul className={styles.list}>
              {facilities
                .filter((f) => f.next_test_date === date)
                .map((f) => (
                  <li key={f.id} className={styles.item}>
                    {f.company.name} · {f.covenant}
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </Card>
  );
}
