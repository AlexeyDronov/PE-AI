import { useSyncExternalStore } from "react";
import { useApiContext } from "@/lib/api/provider";

export function useRecentlyChanged(id: string): boolean {
  const { recent } = useApiContext();
  return useSyncExternalStore(
    recent.subscribe,
    () => recent.has(id),
    () => false,
  );
}

/** Like useRecentlyChanged, for lists: returns a lookup that re-renders the caller when the set changes. */
export function useIsRecent(): (id: string) => boolean {
  const { recent } = useApiContext();
  useSyncExternalStore(recent.subscribe, recent.key, () => "");
  return recent.has;
}
