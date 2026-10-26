"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button, TextField } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api/client";
import { useApiContext } from "@/lib/api/provider";
import { goTo, saveSession, type Session } from "@/lib/api/session";
import styles from "./Login.module.css";

/** Only same-site paths, so a crafted link can't bounce a fresh login to another site. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginView() {
  const { baseUrl } = useApiContext();
  const next = safeNext(useSearchParams().get("next"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      saveSession(await apiFetch<Session>(baseUrl, "/auth/login", { method: "POST", body: { username, password } }));
      goTo(next);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? err.message : "Couldn't reach the server. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.root} data-testid="login">
      <form className={styles.card} onSubmit={(event) => void submit(event)}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            H
          </span>
          <h1 className={styles.title}>Harrowgate Deal Copilot</h1>
        </div>
        <TextField label="Username" value={username} onChange={setUsername} autoComplete="username" required />
        <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" loading={busy} disabled={!username || !password}>
          Sign in
        </Button>
      </form>
    </main>
  );
}
