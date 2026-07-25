"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Inloggen mislukt");

      router.replace(params.get("next") || "/");
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Inloggen mislukt");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="text-lg font-medium tracking-tight">Vault</h1>
          <p className="text-xs text-mute">Privé. Even je wachtwoord.</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          autoComplete="current-password"
          placeholder="Wachtwoord"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-center text-sm outline-none transition focus:border-accent"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-chalk px-4 py-3 text-sm font-medium text-ink transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Even geduld…" : "Openen"}
        </button>

        {error && <p className="text-center text-xs text-red-400">{error}</p>}
        <p className="text-center text-xs text-mute">
          Je blijft daarna een jaar ingelogd op dit apparaat.
        </p>
      </form>
    </div>
  );
}
