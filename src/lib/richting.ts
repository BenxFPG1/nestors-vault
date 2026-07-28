import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import type { Item } from "./notion";

/**
 * Van archief naar richting.
 *
 * Een vault vol referenties is nog geen ontwerp. Dit leest een project —
 * de briefing, de beelden, de tags en vooral jouw eigen opmerkingen — en
 * schrijft er een ontwerprichting uit. Bedoeld als startpunt voor een gesprek
 * of een eerste ontwerp, niet als eindantwoord.
 *
 * Jouw opmerkingen wegen het zwaarst: die zeggen waaróm je iets bewaarde,
 * en dat is precies wat een stapel screenshots zelf niet vertelt.
 */

const MODEL = process.env.VAULT_RICHTING_MODEL || "claude-opus-5";

const Richting = z.object({
  kern: z
    .string()
    .describe(
      "Twee tot vier zinnen: welke richting spreekt uit deze referenties samen? Concreet, geen marketingtaal.",
    ),
  typografie: z.string().describe("Eén tot twee zinnen over letterkeuze en hiërarchie"),
  kleur: z.string().describe("Eén tot twee zinnen over het kleurgebruik"),
  compositie: z.string().describe("Eén tot twee zinnen over indeling, ritme en witruimte"),
  palet: z
    .array(z.string())
    .describe("3 tot 5 hex-kleuren die samen dit project dragen, gekozen uit wat je ziet"),
  spanning: z
    .string()
    .describe(
      "De belangrijkste tegenstelling of twijfel in deze verzameling — waar de referenties elkaar tegenspreken. Lege string als ze allemaal dezelfde kant op wijzen.",
    ),
  vervolg: z
    .array(z.string())
    .describe("2 tot 4 concrete vervolgstappen om deze richting te toetsen of aan te scherpen"),
});

export type Richting = z.infer<typeof Richting>;

const SYSTEM = `Je bent art director bij een Nederlandse creative studio.

Je krijgt de referenties die iemand voor één project heeft verzameld, met hun tags, kleuren
en — belangrijk — de eigen opmerkingen van de eigenaar. Daaruit schrijf je een ontwerprichting.

Hoe je werkt:
- De opmerkingen van de eigenaar wegen het zwaarst. Die vertellen waaróm iets bewaard is.
- Benoem wat je daadwerkelijk ziet terugkomen, niet wat een mooi verhaal zou zijn.
- Als de referenties elkaar tegenspreken, zeg dat. Een eerlijke spanning is bruikbaarder
  dan een gladgestreken samenvatting.
- Schrijf Nederlands, direct en zonder marketingtaal. Geen uitroeptekens, geen "krachtig",
  "uniek" of "naadloos".
- Je schrijft een startpunt voor een gesprek, geen eindoordeel.`;

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ontbreekt");
  client = new Anthropic();
  return client;
}

function omschrijf(item: Item): string {
  return [
    `## ${item.title || "Zonder titel"}`,
    `categorie: ${item.category}`,
    item.tags.length ? `tags: ${item.tags.join(", ")}` : null,
    item.colors.length ? `kleuren: ${item.colors.join(", ")}` : null,
    item.style ? `stijl: ${item.style}` : null,
    item.description ? `beschrijving: ${item.description}` : null,
    item.notes ? `waarom bewaard: ${item.notes}` : null,
    item.annotations.length
      ? `opmerkingen van de eigenaar:\n${item.annotations
          .map((note) => `  - ${note.box ? "[op het beeld] " : ""}${note.text}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function maakRichting(
  project: string,
  briefing: string,
  items: Item[],
): Promise<Richting> {
  if (items.length === 0) throw new Error("Dit project heeft nog geen referenties.");

  const vraag = [
    `Project: ${project}`,
    briefing ? `\nBriefing van de eigenaar:\n${briefing}` : "\n(Geen briefing opgegeven.)",
    `\n${items.length} referenties:\n`,
    items.map(omschrijf).join("\n\n"),
  ].join("\n");

  const antwoord = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(Richting), effort: "medium" },
    messages: [{ role: "user", content: vraag }],
  });

  if (antwoord.stop_reason === "refusal") {
    throw new Error("Het model wilde hier niets over zeggen");
  }
  if (!antwoord.parsed_output) throw new Error("Geen bruikbaar antwoord");

  return antwoord.parsed_output;
}
