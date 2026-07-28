"use client";

import { useState } from "react";

type Richting = {
  kern: string;
  typografie: string;
  kleur: string;
  compositie: string;
  palet: string[];
  spanning: string;
  vervolg: string[];
};

/**
 * De vault leest zichzelf. Verzamelen is de helft; hier maakt hij er een
 * richting van, op basis van de briefing en vooral jouw eigen opmerkingen.
 */
export default function RichtingPaneel({
  project,
  aantal,
}: {
  project: string;
  aantal: number;
}) {
  const [richting, setRichting] = useState<Richting | null>(null);
  const [bezig, setBezig] = useState(false);
  const [probleem, setProbleem] = useState<string | null>(null);

  async function maak() {
    setBezig(true);
    setProbleem(null);
    try {
      const antwoord = await fetch("/api/richting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project }),
      });
      const resultaat = await antwoord.json();
      if (!antwoord.ok) throw new Error(resultaat.error ?? "Richting maken mislukt");
      setRichting(resultaat.richting);
    } catch (error) {
      setProbleem(error instanceof Error ? error.message : "Richting maken mislukt");
    } finally {
      setBezig(false);
    }
  }

  if (aantal === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-mute">Ontwerprichting</p>
        <button
          onClick={maak}
          disabled={bezig}
          className="rounded-full border border-line px-4 py-2 text-xs transition hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {bezig
            ? "Claude leest de referenties…"
            : richting
              ? "opnieuw"
              : `Lees deze ${aantal} referenties`}
        </button>
      </div>

      {probleem && <p className="text-xs text-red-400">{probleem}</p>}

      {!richting && !bezig && (
        <p className="text-xs leading-relaxed text-mute">
          Claude leest de briefing, de beelden en je eigen opmerkingen, en schrijft er een
          richting uit. Bedoeld als startpunt voor een gesprek, niet als eindoordeel.
        </p>
      )}

      {richting && (
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm leading-relaxed text-chalk/90">{richting.kern}</p>

          {richting.palet.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {richting.palet.map((kleur) => (
                <span key={kleur} className="flex items-center gap-2">
                  <span
                    className="h-7 w-7 rounded-lg border border-line"
                    style={{ background: kleur }}
                  />
                  <span className="font-mono text-[11px] text-mute">{kleur}</span>
                </span>
              ))}
            </div>
          )}

          <dl className="space-y-3">
            <Regel label="Typografie" waarde={richting.typografie} />
            <Regel label="Kleur" waarde={richting.kleur} />
            <Regel label="Compositie" waarde={richting.compositie} />
          </dl>

          {richting.spanning && (
            <div className="border-l-2 border-accent pl-3">
              <p className="text-[11px] text-accent">Waar het schuurt</p>
              <p className="mt-1 text-sm leading-relaxed text-chalk/85">
                {richting.spanning}
              </p>
            </div>
          )}

          {richting.vervolg.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] text-mute">Vervolgstappen</p>
              <ul className="space-y-1.5">
                {richting.vervolg.map((stap) => (
                  <li key={stap} className="flex gap-2 text-sm leading-relaxed text-chalk/85">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-mute" />
                    {stap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() =>
              navigator.clipboard.writeText(
                [
                  richting.kern,
                  "",
                  `Typografie: ${richting.typografie}`,
                  `Kleur: ${richting.kleur}`,
                  `Compositie: ${richting.compositie}`,
                  `Palet: ${richting.palet.join(", ")}`,
                  richting.spanning ? `\nWaar het schuurt: ${richting.spanning}` : "",
                  richting.vervolg.length
                    ? `\nVervolg:\n${richting.vervolg.map((s) => `- ${s}`).join("\n")}`
                    : "",
                ].join("\n"),
              )
            }
            className="text-xs text-mute transition hover:text-accent"
          >
            kopieer als tekst
          </button>
        </div>
      )}
    </div>
  );
}

function Regel({ label, waarde }: { label: string; waarde: string }) {
  if (!waarde) return null;
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="w-24 shrink-0 text-xs text-mute">{label}</dt>
      <dd className="text-sm leading-relaxed text-chalk/85">{waarde}</dd>
    </div>
  );
}
