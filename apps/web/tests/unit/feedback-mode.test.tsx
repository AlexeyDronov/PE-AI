/** Found in browser review: annotation mode had no visible cue. */
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { FeedbackOverlay } from "@/features/feedback/FeedbackOverlay";
import { API, server } from "../setup/server";
import { renderWithApi } from "../setup/render";

beforeEach(() => {
  server.use(http.get(`${API}/api/annotations`, () => HttpResponse.json({ items: [], total: 0 })));
});

describe("annotation mode cue", () => {
  it("shows a banner explaining what to do while active", async () => {
    renderWithApi(<FeedbackOverlay />);
    expect(screen.queryByRole("status", { name: /feedback mode/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /leave feedback/i }));
    const banner = screen.getByRole("status", { name: /feedback mode/i });
    expect(banner).toHaveTextContent(/click any element/i);
    expect(banner).toHaveTextContent(/esc/i);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("status", { name: /feedback mode/i })).not.toBeInTheDocument();
  });

  it("the toggle shows a text label, not just an icon", () => {
    renderWithApi(<FeedbackOverlay />);
    expect(screen.getByRole("button", { name: /leave feedback/i })).toHaveTextContent(/feedback/i);
  });

  it("marks the document while active so the cursor and outline styles apply", async () => {
    renderWithApi(<FeedbackOverlay />);
    await userEvent.click(screen.getByRole("button", { name: /leave feedback/i }));
    expect(document.documentElement).toHaveAttribute("data-annotating", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.documentElement).not.toHaveAttribute("data-annotating");
  });
});
