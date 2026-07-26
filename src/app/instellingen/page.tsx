import Link from "next/link";
import { headers } from "next/headers";
import { apiKey } from "@/lib/auth";
import { listProjects } from "@/lib/notion";
import Copy from "@/components/Copy";

export const dynamic = "force-dynamic";

export default async function Instellingen() {
  const key = await apiKey();
  const projects = await listProjects();
  const host = (await headers()).get("host") ?? "localhost:3939";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const base = `${protocol}://${host}`;

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 py-10 sm:px-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-medium tracking-tight">Instellingen</h1>
        <Link href="/" className="text-xs text-mute transition hover:text-accent">
          terug naar de vault
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Je API-sleutel</h2>
        <p className="text-sm leading-relaxed text-mute">
          Hiermee kunnen je telefoon en Claude bij de vault, zonder dat je ergens je
          wachtwoord achterlaat. Deel hem met niemand. Verander je het wachtwoord, dan
          verandert deze sleutel mee en moet je hem opnieuw instellen.
        </p>
        <Copy value={key} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Delen vanaf je telefoon</h2>
        <p className="text-sm leading-relaxed text-mute">
          Met een Snelkoppeling krijg je Vault in het deelmenu van Safari, Instagram en
          je Foto&apos;s. Screenshot maken, delen, klaar — de app hoeft niet open.
        </p>
        <ol className="space-y-2 text-sm leading-relaxed text-chalk/85">
          <li>1. Open de app <span className="text-mute">Opdrachten</span> op je iPhone en maak een nieuwe snelkoppeling.</li>
          <li>2. Zet bovenaan <span className="text-mute">Ontvang afbeeldingen en URL&apos;s uit deelblad</span> aan.</li>
          <li>3. Voeg de actie <span className="text-mute">Voer inhoud van URL uit</span> toe met deze instellingen:</li>
        </ol>
        <div className="space-y-2 rounded-xl border border-line bg-surface p-4 text-xs">
          <Row label="URL" value={`${base}/api/upload?key=${key}`} />
          <Row label="Methode" value="POST" plain />
          <Row label="Aanvraagtekst" value="Formulier" plain />
          <Row label="Veld (afbeelding)" value="file" plain />
          <Row label="Veld (link)" value="url" plain />
        </div>
        <p className="text-sm leading-relaxed text-mute">
          Kies bij het veld de variabele <span className="text-chalk">Snelkoppelinginvoer</span>.
          Deel je een foto, gebruik dan het veld <span className="text-chalk">file</span>;
          deel je een webpagina, gebruik dan <span className="text-chalk">url</span>. Wil je
          allebei kunnen, maak dan twee snelkoppelingen — dat werkt betrouwbaarder dan één
          met een als-dan.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Claude toegang geven</h2>
        <p className="text-sm leading-relaxed text-mute">
          Voeg dit adres toe als connector in de Claude-app of op claude.ai. Claude kan
          dan in je vault zoeken terwijl je ergens anders aan werkt — ook vanaf je telefoon.
        </p>
        <Copy value={`${base}/api/mcp/${key}`} />
        <p className="text-sm leading-relaxed text-mute">
          Voor Claude Code op deze Mac blijft de lokale versie sneller:
        </p>
        <Copy value={`claude mcp add vault -- npx tsx "${process.cwd()}/mcp/server.ts"`} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Eén project delen met een AI</h2>
        <p className="text-sm leading-relaxed text-mute">
          Werk je met een klant of een externe, geef dan een link per project. Wie die
          heeft, ziet uitsluitend de referenties die aan dat project hangen — de rest van
          je vault bestaat voor hem niet.
        </p>
        {projects.length === 0 ? (
          <p className="text-sm text-mute">
            Nog geen projecten. Maak er een aan met de knop{" "}
            <span className="text-chalk">+ project</span> in de vault.
          </p>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project} className="space-y-1.5">
                <p className="text-xs text-mute">{project}</p>
                <Copy
                  value={`${base}/api/mcp/${key}/p/${encodeURIComponent(project)}`}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Automatisch taggen</h2>
        <p className="text-sm leading-relaxed text-mute">
          Items die je rechtstreeks in Notion zet, worden elke ochtend om 06:00 getagd.
          Op het gratis Vercel-plan mag dat één keer per dag; wil je niet wachten, dan
          doet de knop <span className="text-chalk">Tag rest</span> in de vault hetzelfde.
          De vault probeert het ook zelf zodra je hem opent.
        </p>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  plain,
}: {
  label: string;
  value: string;
  plain?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="w-32 shrink-0 text-mute">{label}</span>
      <span className={plain ? "text-chalk" : "break-all font-mono text-chalk"}>
        {value}
      </span>
    </div>
  );
}
