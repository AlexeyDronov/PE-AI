import { act, render, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { useRecentlyChanged } from "@/hooks/useLiveEvents";
import { useResource } from "@/hooks/useResource";
import { RECENT_MS } from "@/lib/api/provider";
import { API, server } from "../setup/server";
import { FakeEventSource, Providers } from "../setup/render";

function counter(path: string) {
  const calls: string[] = [];
  server.use(
    http.get(`${API}/api${path}`, ({ request }) => {
      calls.push(request.url);
      return HttpResponse.json({ items: [], total: calls.length });
    }),
  );
  return calls;
}

describe("live events", () => {
  it("opens one stream to /api/events", () => {
    render(<div />, { wrapper: Providers });
    expect(FakeEventSource.last?.url).toBe(`${API}/api/events`);
  });

  it("refetches resources named in a 'changed' event and leaves others alone", async () => {
    const scenarios = counter("/lbo-scenarios");
    const segments = counter("/segments");
    renderHook(
      () => {
        useResource("lboScenarios");
        useResource("segments");
      },
      { wrapper: Providers },
    );
    await waitFor(() => expect(scenarios).toHaveLength(1));
    await waitFor(() => expect(segments).toHaveLength(1));

    act(() => FakeEventSource.last?.emit("changed", { type: "changed", resources: ["lbo-scenarios"], ids: ["s1"] }));
    await waitFor(() => expect(scenarios).toHaveLength(2));
    expect(segments).toHaveLength(1);
  });

  it("maps server resource names to every client key that reads them", async () => {
    const list = counter("/research-reports");
    renderHook(() => useResource("researchReports"), { wrapper: Providers });
    await waitFor(() => expect(list).toHaveLength(1));
    act(() =>
      FakeEventSource.last?.emit("changed", { type: "changed", resources: ["research-reports"], ids: ["r1"] }),
    );
    await waitFor(() => expect(list).toHaveLength(2));
  });

  it("flags recently changed ids for the live-row highlight, then clears them", async () => {
    const { result } = renderHook(() => useRecentlyChanged("d9"), { wrapper: Providers });
    expect(result.current).toBe(false);
    act(() => FakeEventSource.last?.emit("changed", { type: "changed", resources: ["deals"], ids: ["d9"] }));
    expect(result.current).toBe(true);
    await waitFor(() => expect(result.current).toBe(false), { timeout: RECENT_MS + 1000 });
  });

  it("serves a page revisit from cache, since 'changed' events keep it fresh", async () => {
    const segments = counter("/segments");
    function Page({ show }: { show: boolean }) {
      return show ? <Segments /> : null;
    }
    function Segments() {
      useResource("segments");
      return null;
    }
    const { rerender } = render(<Page show />, { wrapper: Providers });
    await waitFor(() => expect(segments).toHaveLength(1));
    rerender(<Page show={false} />);
    rerender(<Page show />);
    await new Promise((r) => setTimeout(r, 50));
    expect(segments).toHaveLength(1);
  });

  it("refetches everything when the stream reconnects, as events may have been missed", async () => {
    const segments = counter("/segments");
    renderHook(() => useResource("segments"), { wrapper: Providers });
    await waitFor(() => expect(segments).toHaveLength(1));
    act(() => FakeEventSource.last?.emit("open", {}));
    await new Promise((r) => setTimeout(r, 50));
    expect(segments).toHaveLength(1);
    act(() => FakeEventSource.last?.emit("open", {}));
    await waitFor(() => expect(segments).toHaveLength(2));
  });

  it("closes the stream on unmount", () => {
    const { unmount } = render(<div />, { wrapper: Providers });
    const es = FakeEventSource.last;
    unmount();
    expect(es?.closed).toBe(true);
  });
});
