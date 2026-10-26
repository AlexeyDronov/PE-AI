"use client";

import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { ErrorState, ReadOnlyContext } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useApiContext } from "@/lib/api/provider";
import { goTo, type Me, SIGNED_OUT } from "@/lib/api/session";

const SessionContext = createContext<Me | null>(null);

/** The signed-in account, or null outside the gate. */
export function useSession(): Me | null {
  return useContext(SessionContext);
}

const VIEW_ONLY = "View-only account";

/** Shows the app only to a signed-in user (or to everyone when the API has access control off); guest is read-only. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { baseUrl } = useApiContext();
  const pathname = usePathname();
  const here = useRef(pathname);
  here.current = pathname;
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const toLogin = () => goTo(`/login?next=${encodeURIComponent(here.current)}`);
    window.addEventListener(SIGNED_OUT, toLogin);
    let live = true;
    apiFetch<Me>(baseUrl, "/auth/me")
      .then((account) => live && setMe(account))
      .catch((error: unknown) => {
        if (!live) return;
        if (error instanceof ApiError && error.status === 401) toLogin();
        else setFailed(error instanceof Error ? error.message : "Couldn't reach the server.");
      });
    return () => {
      live = false;
      window.removeEventListener(SIGNED_OUT, toLogin);
    };
  }, [baseUrl, attempt]);

  if (failed) {
    return (
      <ErrorState
        message={failed}
        onRetry={() => {
          setFailed(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (!me) return null;
  return (
    <SessionContext.Provider value={me}>
      <ReadOnlyContext.Provider value={me.role === "guest" ? VIEW_ONLY : null}>{children}</ReadOnlyContext.Provider>
    </SessionContext.Provider>
  );
}
