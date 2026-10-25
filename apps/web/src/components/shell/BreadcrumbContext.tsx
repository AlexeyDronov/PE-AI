"use client";

import { createContext, useContext, useEffect } from "react";
import type { Crumb } from "@/components/ui";

export const BreadcrumbSetter = createContext<(crumbs: Crumb[] | undefined) => void>(() => undefined);

/** Lets a page replace the route-derived breadcrumb while it is mounted. */
export function useBreadcrumb(crumbs: Crumb[] | undefined) {
  const set = useContext(BreadcrumbSetter);
  const key = crumbs ? JSON.stringify(crumbs) : undefined;
  useEffect(() => {
    set(key ? (JSON.parse(key) as Crumb[]) : undefined);
    return () => set(undefined);
  }, [set, key]);
}
