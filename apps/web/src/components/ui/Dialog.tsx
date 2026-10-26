"use client";

import * as D from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import styles from "./Dialog.module.css";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; title: string; children?: ReactNode };

function Base({ open, onOpenChange, title, children, side }: Props & { side?: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={styles.overlay} />
        <D.Content className={side ? styles.drawer : styles.dialog} aria-describedby={undefined}>
          <D.Title className={styles.title}>{title}</D.Title>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Dialog(props: Props) {
  return <Base {...props} />;
}

export function Drawer(props: Props) {
  return <Base {...props} side />;
}
