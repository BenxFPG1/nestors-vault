"use client";

import { useEffect, useRef, useState } from "react";

type Status = { kind: "idle" | "busy" | "ok" | "warn" | "error"; text: string };

export default function AddBar({ onAdded }: { onAdded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [fullPage, setFullPage] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  // Als de vault denkt dat je dit al hebt, bewaren we de poging even.
  const [twin, setTwin] = useState<{ file: File | null; url: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = status.kind === "busy";

  async function submit(chosen?: File, force = false) {
    const picked = chosen ?? file;
    if (!picked && !url.trim()) {
      setStatus({ kind: "error", text: "Kies een foto of plak een link." });
      return;
    }

    setStatus({
      kind: "busy",
      text: picked
        ? "Uploaden en taggen…"
        : fullPage
          ? "Hele pagina vastleggen, dit duurt wat langer…"
          : "Screenshot maken en taggen…",
    });

    const body = new FormData();
    if (picked) body.append("file", picked);
    if (url.trim()) body.append("url", url.trim());
    if (notes.trim()) body.append("notes", notes.trim());
    if (force) body.append("force", "1");
    if (fullPage && !picked) body.append("fullPage", "1");

    try {
      const response = await fetch("/api/upload", { method: "POST", body });
      const result = await response.json();

      if (response.status === 409 && result.duplicate) {
        setTwin({ file: picked ?? null, url: url.trim() });
        setStatus({ kind: "warn", text: result.error });
        return;
      }

      if (!response.ok) throw new Error(result.error ?? "Toevoegen mislukt");
      setTwin(null);

      setFile(null);
      setUrl("");
      setNotes("");
      if (fileInput.current) fileInput.current.value = "";

      setStatus(
        result.warning
          ? { kind: "warn", text: result.warning }
          : result.tagging
            ? {
                kind: "ok",
                text:
                  result.via === "actions"
                    ? "Toegevoegd — Claude beschrijft hem (duurt een paar minuten)"
                    : "Toegevoegd — Claude beschrijft hem nu",
              }
            : { kind: "ok", text: `Toegevoegd: ${result.item?.title || "nieuw item"}` },
      );
      onAdded();

      // Het beschrijven loopt door nadat het antwoord al verstuurd is, dus
      // halen we de kaart later opnieuw op met tags en al. Via GitHub Actions
      // duurt dat een paar minuten; direct via de API zo'n twintig seconden.
      if (result.tagging) {
        const momenten =
          result.via === "actions" ? [90_000, 180_000, 300_000] : [9_000, 20_000];
        for (const wacht of momenten) setTimeout(onAdded, wacht);
      }
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "Toevoegen mislukt",
      });
    }
  }

  // Slepen en plakken op de desktop: een screenshot uit je knipbord is
  // meestal sneller dan hem eerst ergens opslaan.
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      setDragging(true);
    };
    const onDragLeave = () => setDragging(false);
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const dropped = event.dataTransfer?.files?.[0];
      if (dropped?.type.startsWith("image/")) void submit(dropped);
    };
    const onPaste = (event: ClipboardEvent) => {
      const pasted = Array.from(event.clipboardData?.files ?? [])[0];
      if (pasted?.type.startsWith("image/")) void submit(pasted);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  });

  const tone = {
    idle: "text-mute",
    busy: "text-mute",
    ok: "text-accent",
    warn: "text-amber-400",
    error: "text-red-400",
  }[status.kind];

  return (
    <div
      className={`rounded-2xl border p-3 transition ${
        dragging ? "border-accent bg-raised" : "border-line bg-surface"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label
          className={`flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm transition hover:border-accent hover:text-accent ${
            busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              const chosen = event.target.files?.[0] ?? null;
              setFile(chosen);
              if (chosen) void submit(chosen);
            }}
          />
          Foto of screenshot
        </label>

        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          disabled={busy}
          inputMode="url"
          placeholder="of plak een link"
          className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none transition focus:border-accent disabled:opacity-50"
        />

        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          disabled={busy}
          placeholder="waarom bewaar je dit?"
          className="min-w-0 rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none transition focus:border-accent disabled:opacity-50 sm:w-48"
        />

        <button
          onClick={() => void submit()}
          disabled={busy}
          className="shrink-0 rounded-xl bg-chalk px-5 py-3 text-sm font-medium text-ink transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Bezig…" : "Toevoegen"}
        </button>
      </div>

      {url.trim() && (
        <label className="mt-3 flex cursor-pointer items-center gap-2 px-1 text-xs text-mute">
          <input
            type="checkbox"
            checked={fullPage}
            onChange={(event) => setFullPage(event.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Hele pagina vastleggen — je kunt hem daarna doorscrollen
        </label>
      )}

      <p className={`mt-2 px-1 text-xs ${tone}`}>
        {status.text ||
          "Sleep een afbeelding hierheen, plak er een uit je klembord, of gebruik de knop."}
      </p>

      {twin && (
        <div className="mt-2 flex flex-wrap items-center gap-3 px-1">
          <button
            onClick={() => {
              const again = twin;
              setTwin(null);
              void submit(again.file ?? undefined, true);
            }}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-mute transition hover:border-accent hover:text-accent"
          >
            toch toevoegen
          </button>
          <button
            onClick={() => {
              setTwin(null);
              setFile(null);
              setUrl("");
              setStatus({ kind: "idle", text: "" });
              if (fileInput.current) fileInput.current.value = "";
            }}
            className="text-xs text-mute transition hover:text-chalk"
          >
            laat maar
          </button>
        </div>
      )}
    </div>
  );
}
