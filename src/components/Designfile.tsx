"use client";

import { useState } from "react";

/**
 * De designfile is het complete ontwerpdocument van een project: doel,
 * doelgroep, stijlrichting, kleur, typografie, do's en don'ts. Claude vult
 * hem op basis van de referenties en de briefing; daarna is hij gewoon
 * handmatig bij te schaven.
 */
export default function Designfile({
  project,
  initial,
}: {
  project: string;
  initial: string;
}) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [open, setOpen] = useState(Boolean(initial));
  const [busy, setBusy] = useState<"genereren" | "opslaan" | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const dirty = text !== saved;

  async function genereer() {
    setBusy("genereren");
    setFout(null);
    try {
      const response = await fetch("/api/designfile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Genereren mislukt");
      setText(result.content);
      setSaved(result.content);
      setOpen(true);
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Genereren mislukt");
    } finally {
      setBusy(null);
    }
  }

  async function bewaar() {
    setBusy("opslaan");
    setFout(null);
    try {
      const response = await fetch("/api/designfile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, content: text }),
      });
      if (!response.ok) throw new Error("Opslaan mislukt");
      setSaved(text);
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Opslaan mislukt");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-mute transition hover:text-chalk"
        >
          Designfile {open ? "▾" : "▸"}
        </button>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={bewaar}
              disabled={busy !== null}
              className="rounded-full bg-chalk px-4 py-1.5 text-xs font-medium text-ink transition disabled:opacity-50"
            >
              {busy === "opslaan" ? "opslaan…" : "bewaar"}
            </button>
          )}
          <button
            onClick={genereer}
            disabled={busy !== null}
            className="rounded-full border border-line px-4 py-1.5 text-xs text-mute transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {busy === "genereren"
              ? "Claude schrijft…"
              : saved
                ? "✦ Opnieuw laten invullen"
                : "✦ Laat Claude invullen"}
          </button>
        </div>
      </div>

      {fout && <p className="text-xs text-red-400">{fout}</p>}

      {open && (
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={text ? 24 : 8}
          placeholder={
            "Het complete ontwerpdocument voor dit project: doel, doelgroep, stijlrichting, kleur, typografie, do's en don'ts.\n\nKlik op ✦ om hem door Claude te laten invullen op basis van je referenties en briefing."
          }
          className="w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed outline-none transition focus:border-accent"
        />
      )}
    </div>
  );
}
