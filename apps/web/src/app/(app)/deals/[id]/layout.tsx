import type { ReactNode } from "react";
import { DealHeader } from "@/features/deal/DealHeader";
import styles from "./layout.module.css";

export default async function DealLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className={styles.root}>
      <DealHeader dealId={id} />
      {children}
    </div>
  );
}
