import type { components } from "@contracts/openapi";

export type Session = components["schemas"]["SessionRead"];
export type Me = components["schemas"]["MeRead"];

const STORAGE_KEY = "harrowgate-session";
/** Dispatched on window when the API rejects the stored session. */
export const SIGNED_OUT = "harrowgate:signed-out";

export function readSession(): Session | null {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Session | null;
    return session && new Date(session.expires_at) > new Date() ? session : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/** The bearer header for the stored session, if any. */
export function authHeader(): Record<string, string> {
  const session = readSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}

/** Full-page navigation, so every provider (and the event stream) restarts with the new session. */
export function goTo(url: string): void {
  window.location.assign(url);
}
