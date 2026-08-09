"use client";

import { useEffect, useRef, useState } from "react";

type Item = { id: string; title: string; category: string; tags: string[] };

/** "https://www.funtownstudio.com/over" wordt "funtownstudio.com". */
function hostVan(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Klein venster, één handeling. Bewust géén automatische toevoeging bij het
 * openen: dan zou een misklik op de bookmarklet meteen een item opleveren, en
 * dan mis je ook het moment waarop je nog weet wáárom je dit bewaart.
 */
export default function Toevoegen({
  url,
  titel,
  projecten,
}: {
  url: string;
  titel: string;
  projecten: string[];
}) {
  const [waarom, setWaarom] = useState("");
  const [gekozen, setGekozen] = useState<string[]>([]);
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState<Item | null>(null);
  const [waarschuwing, setWaarschuwing] = useState<string | null>(null);
  const [probleem, setProbleem] = useState<string | null>(null);
  const [dubbel, setDubbel] = useState<{ title: string } | null>(null);
  const [wachten, setWachten] = useState(false);

  const veld = useRef<HTMLInputElement>(null);

  useEffect(() => {
    veld.current?.focus();
  }, []);

  async function voegToe(forceer = false) {
    setBezig(true);
    setProbleem(null);
    setWaarschuwing(null);

    const body = new FormData();
    body.append("url", url);
    if (waarom.trim()) body.append("notes", waarom.trim());
    if (forceer) body.append("force", "1");

    try {
      const antwoord = await fetch("/api/upload", { method: "POST", body });
      const resultaat = await antwoord.json();

      if (antwoord.status === 409 && resultaat.duplicate) {
        setDubbel({ title: resultaat.duplicate.title });
        return;
      }
      if (!antwoord.ok) throw new Error(resultaat.error ?? "Toevoegen mislukt");

      setDubbel(null);
      if (resultaat.warning) setWaarschuwing(resultaat.warning);
      setKlaar(resultaat.item);

      // Projecten koppelen kan pas als het item bestaat.
      if (gekozen.length && resultaat.item?.id) {
        await fetch(`/api/item/${resultaat.item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projects: gekozen }),
        });
      }

      // Het taggen loopt op de achtergrond door, dus we wachten even op de
      // echte titel in plaats van "Nieuw item" te laten staan. Via GitHub
      // Actions (abonnement) duurt dat een paar minuten; direct via de API
      // zo'n twintig seconden.
      if (resultaat.tagging && resultaat.item?.id) {
        setWachten(true);
        const pogingen = resultaat.via === "actions" ? 60 : 20;
        const pauze = resultaat.via === "actions" ? 5000 : 2500;
        for (let poging = 0; poging < pogingen; poging++) {
          await new Promise((r) => setTimeout(r, pauze));
          try {
            const verse = await fetch(`/api/item/${resultaat.item.id}`);
            if (!verse.ok) continue;
            const { item } = await verse.json();
            if (item?.tags?.length || item?.status === "mislukt") {
              setKlaar(item);
              break;
            }
          } catch {
            // netwerkhikje; gewoon nog een keer proberen
          }
        }
        setWachten(false);
      }
    } catch (error) {
      setProbleem(error instanceof Error ? error.message : "Toevoegen mislukt");
    } finally {
      setBezig(false);
    }
  }

  if (!url) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-sm text-mute">
          Geen adres meegegeven. Gebruik de bookmarklet uit Instellingen.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 p-5 sm:p-6">
      <header className="space-y-1">
        <p className="text-xs text-mute">Toevoegen aan vault</p>
        <p className="text-base leading-snug">{titel || hostVan(url)}</p>
        <p className="truncate font-mono text-[11px] text-mute">{url}</p>
      </header>

      {klaar ? (
        <div className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm">
              {wachten ? "Toegevoegd — Claude beschrijft hem nu…" : klaar.title || "Toegevoegd"}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {!wachten && (
                <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] text-accent">
                  {klaar.category}
                </span>
              )}
              {klaar.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="text-[11px] text-mute">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {waarschuwing && <p className="text-xs text-amber-400">{waarschuwing}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => window.close()}
              className="flex-1 rounded-xl bg-chalk px-4 py-3 text-sm font-medium text-ink"
            >
              Sluiten
            </button>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-line px-4 py-3 text-center text-sm text-mute transition hover:text-chalk"
            >
              Vault openen
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-xs text-mute">Waarom bewaar je dit?</label>
            <input
              ref={veld}
              value={waarom}
              onChange={(event) => setWaarom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !bezig) void voegToe();
              }}
              placeholder="bv. de manier waarop de navigatie meeschuift"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none transition focus:border-accent"
            />
            <p className="text-[11px] leading-relaxed text-mute">
              Eén zin is genoeg. Dit bepaalt straks in welke map hij belandt, en het is
              wat de ontwerprichting later scherp maakt.
            </p>
          </div>

          {projecten.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-mute">Aan een project koppelen</p>
              <div className="flex flex-wrap gap-2">
                {projecten.map((project) => {
                  const aan = gekozen.includes(project);
                  return (
                    <button
                      key={project}
                      onClick={() =>
                        setGekozen((lijst) =>
                          aan ? lijst.filter((p) => p !== project) : [...lijst, project],
                        )
                      }
                      className={`rounded-full border px-3 py-2 text-xs transition ${
                        aan
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-line text-mute hover:text-chalk"
                      }`}
                    >
                      {project}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {probleem && <p className="text-xs text-red-400">{probleem}</p>}

          {dubbel ? (
            <div className="space-y-3 rounded-xl border border-amber-400/40 bg-raised p-4">
              <p className="text-xs leading-relaxed text-amber-400">
                Dit lijkt op &ldquo;{dubbel.title}&rdquo; dat je al hebt.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => void voegToe(true)}
                  disabled={bezig}
                  className="rounded-full border border-line px-4 py-2 text-xs transition hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  toch toevoegen
                </button>
                <button
                  onClick={() => window.close()}
                  className="text-xs text-mute transition hover:text-chalk"
                >
                  laat maar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => void voegToe()}
              disabled={bezig}
              className="rounded-xl bg-chalk px-4 py-3.5 text-sm font-medium text-ink transition active:scale-[0.99] disabled:opacity-60"
            >
              {bezig ? "Screenshot maken en taggen…" : "Toevoegen aan vault"}
            </button>
          )}

          <p className="text-center text-[11px] text-mute">
            Toevoegen duurt een paar seconden; de beschrijving volgt vanzelf.
            Je kunt dit venster daarna gewoon sluiten.
          </p>
        </>
      )}
    </div>
  );
}
