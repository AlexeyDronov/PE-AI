/** Access control (user request): sign in as admin or guest; guest is view-only; signed-out users go to /login. */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API, server } from "../setup/server";
import { renderWithApi } from "../setup/render";

vi.mock("@/lib/api/session", async (original) => ({ ...(await original<object>()), goTo: vi.fn() }));
let pathname = "/deals";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams("next=%2Fdeals"),
}));

const session = await import("@/lib/api/session");
const { apiFetch } = await import("@/lib/api/client");
const { Button, FileButton, ReadOnlyContext } = await import("@/components/ui");
const { AuthGate } = await import("@/components/shell/AuthGate");
const { AppShell } = await import("@/components/shell/AppShell");
const { LoginView } = await import("@/features/auth/LoginView");

const SESSION = { token: "t0k", username: "guest", role: "guest" as const, expires_at: "2999-01-01T00:00:00Z" };
const goTo = vi.mocked(session.goTo);

beforeEach(() => {
  pathname = "/deals";
  goTo.mockClear();
  server.use(http.get(`${API}/api/funds`, () => HttpResponse.json({ items: [], total: 0 })));
});

afterEach(() => {
  localStorage.clear();
});

describe("API client", () => {
  it("sends the stored session as a bearer token", async () => {
    let seen: string | null = null;
    server.use(
      http.get(`${API}/api/deals`, ({ request }) => {
        seen = request.headers.get("authorization");
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    session.saveSession(SESSION);
    await apiFetch(API, "/deals");
    expect(seen).toBe("Bearer t0k");
  });

  it("forgets a session the API rejects and announces it", async () => {
    server.use(
      http.get(`${API}/api/deals`, () =>
        HttpResponse.json({ error: { code: "unauthorized", message: "Sign in to continue" } }, { status: 401 }),
      ),
    );
    session.saveSession(SESSION);
    const signedOut = vi.fn();
    window.addEventListener(session.SIGNED_OUT, signedOut);
    await expect(apiFetch(API, "/deals")).rejects.toMatchObject({ status: 401 });
    expect(session.readSession()).toBeNull();
    expect(signedOut).toHaveBeenCalled();
    window.removeEventListener(session.SIGNED_OUT, signedOut);
  });

  it("ignores an expired session", () => {
    session.saveSession({ ...SESSION, expires_at: "2000-01-01T00:00:00Z" });
    expect(session.readSession()).toBeNull();
    expect(session.authHeader()).toEqual({});
  });
});

describe("read-only mode", () => {
  it("disables buttons that write, with the reason, and leaves the rest alone", () => {
    render(
      <ReadOnlyContext.Provider value="View-only account">
        <Button writes>Run research</Button>
        <Button>View as table</Button>
        <FileButton writes onFile={() => undefined}>
          Upload a document
        </FileButton>
      </ReadOnlyContext.Provider>,
    );
    const run = screen.getByRole("button", { name: "Run research" });
    expect(run).toBeDisabled();
    expect(run).toHaveAttribute("title", "View-only account");
    expect(screen.getByRole("button", { name: "View as table" })).toBeEnabled();
    expect(screen.getByLabelText(/upload a document/i)).toBeDisabled();
  });

  it("does nothing for admin", () => {
    render(<Button writes>Run research</Button>);
    expect(screen.getByRole("button", { name: "Run research" })).toBeEnabled();
  });
});

describe("AuthGate", () => {
  it("sends signed-out visitors to the login page, remembering where they were", async () => {
    server.use(
      http.get(`${API}/api/auth/me`, () =>
        HttpResponse.json({ error: { code: "unauthorized", message: "Sign in to continue" } }, { status: 401 }),
      ),
    );
    renderWithApi(
      <AuthGate>
        <p>secret</p>
      </AuthGate>,
    );
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/login?next=%2Fdeals"));
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("shows the app to a guest in read-only mode, with who is signed in and a way out", async () => {
    session.saveSession(SESSION);
    server.use(
      http.get(`${API}/api/auth/me`, () => HttpResponse.json({ username: "guest", role: "guest", auth_enabled: true })),
    );
    const user = userEvent.setup();
    renderWithApi(
      <AuthGate>
        <AppShell>
          <Button writes>Draft memo</Button>
        </AppShell>
      </AuthGate>,
    );
    expect(await screen.findByRole("button", { name: "Draft memo" })).toBeDisabled();
    const banner = screen.getByRole("banner");
    expect(banner).toHaveTextContent("guest");
    expect(banner).toHaveTextContent(/view only/i);
    await user.click(within(banner).getByRole("button", { name: "Sign out" }));
    expect(session.readSession()).toBeNull();
    expect(goTo).toHaveBeenCalledWith("/login");
  });

  it("lets everything through when access control is off (local development)", async () => {
    server.use(
      http.get(`${API}/api/auth/me`, () => HttpResponse.json({ username: "local", role: "admin", auth_enabled: false })),
    );
    renderWithApi(
      <AuthGate>
        <AppShell>
          <Button writes>Draft memo</Button>
        </AppShell>
      </AuthGate>,
    );
    expect(await screen.findByRole("button", { name: "Draft memo" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});

describe("LoginView", () => {
  it("signs in and returns to the page the user came from", async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/api/auth/login`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...SESSION, username: "admin", role: "admin" });
      }),
    );
    const user = userEvent.setup();
    renderWithApi(<LoginView />);
    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "s3cret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/deals"));
    expect(body).toEqual({ username: "admin", password: "s3cret" });
    expect(session.readSession()?.username).toBe("admin");
  });

  it("explains a wrong password and stays put", async () => {
    server.use(
      http.post(`${API}/api/auth/login`, () =>
        HttpResponse.json({ error: { code: "unauthorized", message: "Wrong username or password" } }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderWithApi(<LoginView />);
    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "nope");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong username or password");
    expect(goTo).not.toHaveBeenCalled();
  });
});
