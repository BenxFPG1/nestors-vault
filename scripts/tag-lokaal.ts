/**
 * Taggen zonder API-kosten, via Claude Code op deze Mac.
 *
 *   npm run tag:lokaal
 *   npm run tag:lokaal -- --aantal 50
 *
 * Claude Code draait op je abonnement in plaats van op API-tegoed. Het verschil
 * met de knop in de webapp: dit werkt alleen hier, en alleen als deze Mac aan
 * staat. De vault zelf blijft ongemoeid — er gaan alleen tags naar Notion.
 *
 * Eerst eenmalig inloggen als dat nog niet gebeurd is:
 *   claude          (en dan /login)
 */
import "./env";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { imageUrl, saveTags, setStatus, listItems } from "../src/lib/notion";
import { fingerprint } from "../src/lib/fingerprint";
import { CATEGORIES, TAGS } from "../src/lib/taxonomy";

const aantalIndex = process.argv.indexOf("--aantal");
const MAX = aantalIndex > -1 ? Number(process.argv[aantalIndex + 1]) || 20 : 20;

const OPDRACHT = `Je bent de conservator van een persoonlijke design-inspiratiebibliotheek van een Nederlandse creative studio.

Bekijk de afbeelding en beschrijf hem zo dat hij later terug te vinden is.

Antwoord met UITSLUITEND geldige JSON, zonder uitleg eromheen en zonder codeblok:
{
  "title": "korte Nederlandse titel, max 6 woorden",
  "category": "één waarde uit: ${CATEGORIES.join(" | ")}",
  "tags": ["3 tot 6 waarden, alleen uit: ${TAGS.join(", ")}"],
  "colors": ["2 tot 4 hex-kleuren die je echt ziet, bv. #1A1A1A"],
  "style": "één Nederlandse zin over de visuele stijl",
  "description": "één tot twee Nederlandse zinnen: wat is dit en waarom bewaar je het",
  "text": "de tekst die letterlijk in beeld staat, max 40 woorden, lege string als er geen tekst is"
}

Regels:
- Verzin nooit tags buiten de toegestane lijst. Liever vier rake tags dan zes vage.
- Schrijf in het Nederlands, zonder marketingtaal.`;

/** Claude Code antwoordt soms met een codeblok of wat tekst eromheen. */
function jsonUit(tekst: string): Record<string, unknown> | null {
  const zonderBlok = tekst.replace(/```(?:json)?/g, "");
  const start = zonderBlok.indexOf("{");
  const eind = zonderBlok.lastIndexOf("}");
  if (start === -1 || eind <= start) return null;

  try {
    return JSON.parse(zonderBlok.slice(start, eind + 1));
  } catch {
    return null;
  }
}

async function beschrijf(bestand: string, waarom: string): Promise<Record<string, unknown>> {
  const vraag = waarom
    ? `${OPDRACHT}\n\nWaarom de eigenaar dit bewaart: ${waarom}\nDat is leidend voor de categorie.\n\nDe afbeelding staat hier: ${bestand}`
    : `${OPDRACHT}\n\nDe afbeelding staat hier: ${bestand}`;

  // Twee valkuilen zitten hier vlak naast elkaar. Claude Code blijft hangen
  // als je stdin openlaat, en — belangrijker — een gezette ANTHROPIC_API_KEY
  // overschrijft stilletjes je inlog. Dan draait dit alsnog op API-tegoed in
  // plaats van op je abonnement, en is de hele opzet zinloos. Dus weg ermee.
  const omgeving = { ...process.env };
  delete omgeving.ANTHROPIC_API_KEY;
  delete omgeving.ANTHROPIC_AUTH_TOKEN;

  const stdout = await new Promise<string>((klaar, fout) => {
    const proces = spawn(
      "claude",
      ["-p", vraag, "--allowedTools", "Read", "--output-format", "json"],
      { stdio: ["ignore", "pipe", "pipe"], env: omgeving },
    );

    let uit = "";
    let err = "";
    proces.stdout.on("data", (stuk) => (uit += stuk));
    proces.stderr.on("data", (stuk) => (err += stuk));

    const wekker = setTimeout(() => {
      proces.kill();
      fout(new Error("Claude Code deed er te lang over"));
    }, 300_000);

    proces.on("error", (e) => {
      clearTimeout(wekker);
      fout(e);
    });
    proces.on("close", () => {
      clearTimeout(wekker);
      uit.trim() ? klaar(uit) : fout(new Error(err.trim() || "geen antwoord"));
    });
  });

  const envelop = JSON.parse(stdout) as {
    is_error?: boolean;
    result?: string;
    total_cost_usd?: number;
  };

  if (envelop.is_error) {
    throw new Error(envelop.result || "Claude Code gaf een fout terug");
  }

  const gelezen = jsonUit(envelop.result ?? "");
  if (!gelezen) throw new Error("Geen bruikbare JSON in het antwoord");

  return gelezen;
}

/* ── Hoofdlus ─────────────────────────────────────────────────────────── */

const items = await listItems();
const todo = items
  .filter((item) => item.tags.length === 0 && item.hasImage)
  .slice(0, MAX);

if (todo.length === 0) {
  console.log("Niets te doen — alles is al getagd.");
  process.exit(0);
}

console.log(`${todo.length} items te taggen, via je Claude Code-abonnement.\n`);

const map = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
let klaar = 0;
let mislukt = 0;

for (const [nummer, item] of todo.entries()) {
  const label = `${nummer + 1}/${todo.length}`;

  try {
    const bron = await imageUrl(item.id);
    if (!bron) throw new Error("geen afbeelding in Notion");

    const antwoord = await fetch(bron);
    if (!antwoord.ok) throw new Error("afbeelding kon niet opgehaald worden");

    const data = Buffer.from(await antwoord.arrayBuffer());
    const bestand = path.join(map, `${item.id}.jpg`);
    fs.writeFileSync(bestand, data);

    const gelezen = await beschrijf(bestand, item.notes);

    // Alles wat buiten de woordenlijst valt gooien we weg; anders sluipt er
    // wildgroei in je filters.
    const tags = Array.isArray(gelezen.tags)
      ? (gelezen.tags as string[]).filter((tag) => (TAGS as readonly string[]).includes(tag))
      : [];
    const categorie = (CATEGORIES as readonly string[]).includes(String(gelezen.category))
      ? String(gelezen.category)
      : "overig";

    await saveTags(
      item.id,
      {
        title: String(gelezen.title ?? "").slice(0, 200),
        category: categorie,
        tags,
        colors: Array.isArray(gelezen.colors) ? (gelezen.colors as string[]) : [],
        style: String(gelezen.style ?? ""),
        description: String(gelezen.description ?? ""),
        text: String(gelezen.text ?? ""),
      },
      { fingerprint: item.fingerprint || (await fingerprint(data)) },
    );

    fs.unlinkSync(bestand);
    klaar++;
    console.log(`${label}  ${gelezen.title}  (${categorie})`);
  } catch (error) {
    mislukt++;
    const melding = error instanceof Error ? error.message : String(error);
    console.log(`${label}  MISLUKT — ${melding}`);

    if (
      melding.includes("authenticate") ||
      melding.includes("OAuth") ||
      melding.includes("logged in") ||
      melding.includes("Login expired") ||
      melding.includes("Credit balance")
    ) {
      console.log(
        "\nClaude Code kan niet bij je abonnement." +
          "\nLokaal: draai `claude` en log in met /login." +
          "\nIn GitHub Actions: genereer een nieuwe token met `claude setup-token`" +
          "\nen zet hem als repo-secret CLAUDE_CODE_OAUTH_TOKEN.",
      );
      process.exitCode = 1;
      break;
    }

    await setStatus(item.id, "mislukt").catch(() => {});
  }
}

fs.rmSync(map, { recursive: true, force: true });
console.log(`\nKlaar — ${klaar} getagd, ${mislukt} mislukt. Kosten: €0.`);
