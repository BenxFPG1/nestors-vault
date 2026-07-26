import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import { CATEGORIES, TAGS } from "./taxonomy";
import { FAMILIES } from "./colors";
import type { Item } from "./notion";
import { familiesOf } from "./colors";

/**
 * Zoeken op woorden vindt alleen wat er letterlijk staat. Een vraag als
 * "rustige premium uitstraling" levert dan niets op, terwijl je vault vol
 * staat met items die "minimal" en "veel-witruimte" heten.
 *
 * We vertalen de vraag daarom eerst naar de taxonomie. Dat is nauwkeuriger
 * dan embeddings bij een vaste woordenlijst, en het gebruikt de sleutel die
 * je al hebt in plaats van een tweede dienst.
 */

const MODEL = process.env.VAULT_SEARCH_MODEL || "claude-haiku-4-5";

const Interpretation = z.object({
  tags: z.array(z.enum(TAGS)).describe("Tags die bij deze vraag passen, 0 tot 8"),
  categories: z
    .array(z.enum(CATEGORIES))
    .describe("Passende categorieën, leeg laten als de vraag niet beperkt"),
  colors: z
    .array(z.enum(FAMILIES))
    .describe("Kleurfamilies die genoemd of geïmpliceerd worden, mag leeg zijn"),
  keywords: z
    .array(z.string())
    .describe("Losse Nederlandse trefwoorden uit de vraag, 0 tot 6"),
});

export type Interpretation = z.infer<typeof Interpretation>;

const SYSTEM = `Je vertaalt een zoekvraag over design-inspiratie naar de vaste woordenlijst van een archief.

Denk mee in plaats van letterlijk te vertalen: "rustige premium uitstraling" betekent bijvoorbeeld
minimal, veel-witruimte en serif. "Iets met veel bam" betekent maximalistisch en hoog-contrast.

Kies alleen waarden uit de toegestane lijsten. Bij twijfel kies je minder in plaats van meer:
een paar rake tags werkt beter dan acht vage.`;

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ontbreekt");
  client = new Anthropic();
  return client;
}

const cache = new Map<string, Interpretation>();

export async function interpret(question: string): Promise<Interpretation> {
  const key = question.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 1000,
    system: SYSTEM,
    output_config: { format: zodOutputFormat(Interpretation) },
    messages: [{ role: "user", content: `Zoekvraag: ${question}` }],
  });

  if (!response.parsed_output) throw new Error("Geen bruikbare interpretatie");

  // Dezelfde vraag komt vaak twee keer; dit scheelt een API-aanroep.
  if (cache.size > 200) cache.clear();
  cache.set(key, response.parsed_output);

  return response.parsed_output;
}

/** Scoort elk item tegen de geïnterpreteerde vraag. */
export function rank(items: Item[], reading: Interpretation, limit = 24): Item[] {
  const wanted = new Set<string>(reading.tags);
  const colors = new Set<string>(reading.colors);
  const wantedCategories = new Set<string>(reading.categories);

  return items
    .map((item) => {
      const tagHits = item.tags.filter((tag) => wanted.has(tag)).length;
      const categoryHit = wantedCategories.has(item.category) ? 1 : 0;
      const colorHits = familiesOf(item.colors).filter((family) =>
        colors.has(family),
      ).length;

      const haystack = [item.title, item.description, item.style, item.notes]
        .join(" ")
        .toLowerCase();
      const keywordHits = reading.keywords.filter((word) =>
        haystack.includes(word.toLowerCase()),
      ).length;

      return {
        item,
        score: tagHits * 3 + keywordHits * 2 + categoryHit * 2 + colorHits,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}
