"use client";

import * as Popover from "@radix-ui/react-popover";
import { Loader } from "lucide-react";
import { jobKindLabel } from "@/components/domain/jobs";
import { useResource } from "@/hooks/useResource";
import styles from "./JobsIndicator.module.css";

export function JobsIndicator() {
  const jobs = useResource("jobs", { status: "running" }).data?.items ?? [];
  const count = jobs.length;
  const label = count === 0 ? "No Copilot jobs running" : `${count} Copilot job${count === 1 ? "" : "s"} running`;

  return (
    <Popover.Root>
      <Popover.Trigger className={styles.trigger} aria-label={label} data-active={count > 0 ? "true" : undefined}>
        <Loader size={16} strokeWidth={1.5} aria-hidden="true" className={styles.icon} />
        <span aria-hidden="true">{count === 0 ? "Idle" : `${count} running`}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className={styles.content}>
          {count === 0 ? <p className={styles.empty}>Nothing running right now.</p> : null}
          <ul className={styles.list}>
            {jobs.map((job) => (
              <li key={job.id} className={styles.job}>
                <b>{jobKindLabel(job.kind)}</b>
                <span>{job.progress.at(-1)?.message ?? "Starting"}</span>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
