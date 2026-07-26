"use client";

import { useState } from "react";

/** De briefing maakt van een project een werkplek in plaats van een filter. */
export default function Briefing({
  project,
  initial,
}: {
  project: string;
  initial: string;
}) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState<string>(initial);
  const [busy, setBusy] = useState(false);

  const dirty = text !== saved;

  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, text }),
      });
      if (response.ok) setSaved(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-mute">Briefing</p>
        {dirty && (
          <button
            onClick={save}
            disabled={busy}
            className="rounded-full bg-chalk px-4 py-1.5 text-xs font-medium text-ink transition disabled:opacity-50"
          >
            {busy ? "opslaan…" : "bewaar"}
          </button>
        )}
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        placeholder="Waar gaat dit project over? Wat is de toon, wie is de klant, waar moet het naartoe? Een AI met de projectlink leest dit mee."
        className="w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-accent"
      />
    </div>
  );
}
