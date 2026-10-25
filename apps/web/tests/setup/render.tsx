import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ApiProvider } from "@/lib/api/provider";
import { API } from "./server";

/** A controllable stand-in for the browser EventSource. */
export class FakeEventSource {
  static last: FakeEventSource | null = null;
  listeners = new Map<string, ((e: MessageEvent) => void)[]>();
  closed = false;
  constructor(public url: string) {
    FakeEventSource.last = this;
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener() {}
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    for (const fn of this.listeners.get(type) ?? []) fn(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ApiProvider baseUrl={API} eventSourceFactory={(url) => new FakeEventSource(url)} retry={false}>
      {children}
    </ApiProvider>
  );
}

export function renderWithApi(ui: ReactElement) {
  return render(ui, { wrapper: Providers });
}
