"use client";

import { QueryClient, QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { resourceKey, resources, type ResourceKey } from "./registry";

export const RECENT_MS = 1600;

// React already batches updates; deliver query notifications in the same tick so state is never a timer behind.
notifyManager.setScheduler((cb) => cb());

type EventSourceLike = {
  addEventListener(type: string, listener: (e: MessageEvent<string>) => void): void;
  close(): void;
};

/** Tiny external store of recently changed ids, read via useSyncExternalStore. */
export class RecentStore {
  private ids = new Set<string>();
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  has = (id: string) => this.ids.has(id);

  /** Stable snapshot of the current ids, for useSyncExternalStore. */
  key = () => [...this.ids].sort().join("|");

  mark(ids: string[]) {
    ids.forEach((id) => this.ids.add(id));
    this.emit();
    setTimeout(() => {
      ids.forEach((id) => this.ids.delete(id));
      this.emit();
    }, RECENT_MS);
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }
}

type ApiContextValue = { baseUrl: string; recent: RecentStore };
const ApiContext = createContext<ApiContextValue | null>(null);

export function useApiContext(): ApiContextValue {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error("ApiProvider is missing");
  return ctx;
}

type ChangedEvent = { resources?: string[]; ids?: string[] };
type JobEvent = { id: string };

export function ApiProvider({
  baseUrl,
  eventSourceFactory = (url) => new EventSource(url),
  retry = 1,
  children,
}: {
  baseUrl: string;
  eventSourceFactory?: (url: string) => EventSourceLike;
  retry?: number | false;
  children: ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry } } }));
  const [recent] = useState(() => new RecentStore());

  useEffect(() => {
    const es = eventSourceFactory(`${baseUrl}/api/events`);
    const parse = <T,>(e: MessageEvent<string>): T => JSON.parse(e.data) as T;
    es.addEventListener("changed", (e) => {
      const ev = parse<ChangedEvent>(e);
      const names = new Set(ev.resources ?? []);
      void queryClient.invalidateQueries({
        predicate: (q) => {
          const entry = resources[q.queryKey[1] as ResourceKey];
          return q.queryKey[0] === "resource" && entry !== undefined && names.has(entry.resource);
        },
      });
      recent.mark(ev.ids ?? []);
    });
    es.addEventListener("job", (e) => {
      const ev = parse<JobEvent>(e);
      void queryClient.invalidateQueries({ queryKey: resourceKey("job", { id: ev.id }) });
    });
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, queryClient, recent]);

  return (
    <ApiContext.Provider value={{ baseUrl, recent }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  );
}
