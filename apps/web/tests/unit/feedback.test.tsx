import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackOverlay } from "@/features/feedback/FeedbackOverlay";
import { getSelector } from "@/features/feedback/selector";
import { API, server } from "../setup/server";
import { FakeEventSource, renderWithApi } from "../setup/render";

type Note = { id: string; note: string; route: string; selector: string; status: string };
let notes: Note[];
let created: Record<string, unknown>[];
let updated: Record<string, unknown>[];

beforeEach(() => {
  notes = [];
  created = [];
  updated = [];
  window.history.replaceState({}, "", "/deals");
  server.use(
    http.get(`${API}/api/annotations`, () => HttpResponse.json({ items: notes, total: notes.length })),
    http.post(`${API}/api/commands/create-annotation`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      created.push(body);
      const n = { id: `a${created.length}`, status: "open", ...body } as Note;
      notes = [...notes, n];
      return HttpResponse.json(n, { status: 201 });
    }),
    http.post(`${API}/api/commands/update-annotation`, async ({ request }) => {
      const body = (await request.json()) as { id: string; status: string };
      updated.push(body);
      notes = notes.map((n) => (n.id === body.id ? { ...n, status: body.status } : n));
      return HttpResponse.json(notes.find((n) => n.id === body.id));
    }),
  );
});

function Page({ onClick = () => {} }: { onClick?: () => void }) {
  return (
    <>
      <div data-testid="pipeline-table" onClick={onClick}>
        Pipeline
      </div>
      <FeedbackOverlay />
    </>
  );
}

describe("getSelector", () => {
  it("prefers data-testid, then id, then a structural path", () => {
    document.body.innerHTML =
      '<main><div data-testid="card"><span id="x">a</span><p>b</p><p>c</p></div></main>';
    expect(getSelector(document.querySelector("[data-testid=card]")!)).toBe('[data-testid="card"]');
    expect(getSelector(document.getElementById("x")!)).toBe("#x");
    const sel = getSelector(document.querySelectorAll("p")[1]!);
    expect(document.querySelector(sel)).toBe(document.querySelectorAll("p")[1]);
  });
});

describe("FeedbackOverlay", () => {
  it("has a toggle button and a keyboard shortcut", async () => {
    renderWithApi(<Page />);
    const toggle = screen.getByRole("button", { name: /leave feedback/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.keyDown(document, { key: "F", shiftKey: true });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("ignores the shortcut while typing in a field", () => {
    renderWithApi(
      <>
        <input aria-label="search" />
        <FeedbackOverlay />
      </>,
    );
    const input = screen.getByLabelText("search");
    input.focus();
    fireEvent.keyDown(input, { key: "F", shiftKey: true });
    expect(screen.getByRole("button", { name: /leave feedback/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("captures a note on the clicked element and saves it", async () => {
    const user = userEvent.setup();
    const pageClick = vi.fn();
    renderWithApi(<Page onClick={pageClick} />);
    await user.click(screen.getByRole("button", { name: /leave feedback/i }));
    await user.click(screen.getByTestId("pipeline-table"));
    expect(pageClick).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog", { name: /feedback/i });
    await user.type(within(dialog).getByLabelText(/note/i), "Score column is too narrow");
    await user.click(within(dialog).getByRole("button", { name: /save note/i }));

    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0]).toMatchObject({
      route: "/deals",
      selector: '[data-testid="pipeline-table"]',
      note: "Score column is too narrow",
      theme: "light",
      viewport: { w: window.innerWidth, h: window.innerHeight },
    });
    expect(created[0]).toHaveProperty("rect");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /feedback/i })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /leave feedback/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not save an empty note", async () => {
    const user = userEvent.setup();
    renderWithApi(<Page />);
    await user.click(screen.getByRole("button", { name: /leave feedback/i }));
    await user.click(screen.getByTestId("pipeline-table"));
    const dialog = await screen.findByRole("dialog", { name: /feedback/i });
    expect(within(dialog).getByRole("button", { name: /save note/i })).toBeDisabled();
  });

  it("lists open notes for this page and resolves them", async () => {
    notes = [
      { id: "a1", note: "Too dense", route: "/deals", selector: '[data-testid="pipeline-table"]', status: "open" },
      { id: "a2", note: "Other page", route: "/portfolio", selector: "#x", status: "open" },
    ];
    const user = userEvent.setup();
    renderWithApi(<Page />);
    const open = await screen.findByRole("button", { name: /feedback notes \(1\)/i });
    await user.click(open);
    const drawer = await screen.findByRole("dialog", { name: /feedback notes/i });
    expect(within(drawer).getByText("Too dense")).toBeInTheDocument();
    expect(within(drawer).queryByText("Other page")).not.toBeInTheDocument();

    await user.click(within(drawer).getByRole("button", { name: /resolve/i }));
    await waitFor(() => expect(updated).toEqual([{ id: "a1", status: "resolved" }]));
    act(() => FakeEventSource.last?.emit("changed", { type: "changed", resources: ["annotations"], ids: ["a1"] }));
    await waitFor(() => expect(screen.getByRole("button", { name: /feedback notes \(0\)/i })).toBeInTheDocument());
  });

  it("pins open notes on their element", async () => {
    notes = [
      { id: "a1", note: "Too dense", route: "/deals", selector: '[data-testid="pipeline-table"]', status: "open" },
    ];
    renderWithApi(<Page />);
    const pin = await screen.findByRole("button", { name: /note 1: too dense/i });
    expect(pin).toBeInTheDocument();
  });
});
