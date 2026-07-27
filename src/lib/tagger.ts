import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
// De SDK-helper verwacht Zod v4; de MCP-server gebruikt nog de v3-API.
// Beide leven in hetzelfde pakket, dus we importeren hier expliciet v4.
import * as z from "zod/v4";
import sharp from "sharp";
import { CATEGORIES, TAGS } from "./taxonomy";

const MODEL = process.env.VAULT_TAGGING_MODEL || "claude-opus-5";

/** Boven deze grootte verkleinen we eerst; telefoonfoto's zitten er zo overheen. */
const MAX_IMAGE_BYTES = 3_500_000;

const TagResult = z.object({
  title: z
    .string()
    .describe("Korte Nederlandse titel, max 6 woorden, bv. 'Hero — Studio Dumbar'"),
  category: z.enum(CATEGORIES).describe("De één best passende categorie"),
  tags: z
    .array(z.enum(TAGS))
    .describe("3 tot 6 tags, alleen uit de toegestane lijst"),
  colors: z
    .array(z.string())
    .describe("2 tot 4 dominante kleuren als hex, bv. '#1A1A1A'"),
  style: z
    .string()
    .describe("Eén zin over de visuele stijl, in het Nederlands"),
  description: z
    .string()
    .describe("Eén tot twee zinnen: wat is dit en waarom is het bewaard"),
  text: z
    .string()
    .describe(
      "De tekst die letterlijk in beeld staat: koppen, knopteksten, claims. Max 40 woorden, lege string als er geen tekst is.",
    ),
});

export type TagResult = z.infer<typeof TagResult>;

const SYSTEM = `Je bent de conservator van een persoonlijke design-inspiratiebibliotheek van een Nederlandse creative studio.

Je krijgt een screenshot of afbeelding en beschrijft die zo dat hij later terug te vinden is.

Regels:
- Kies precies één categorie uit de toegestane lijst.
- Gebruik uitsluitend tags uit de toegestane lijst. Verzin er nooit bij. Liever vier rake tags dan zes vage.
- Kleuren zijn hex-codes van wat je daadwerkelijk in het beeld ziet.
- Schrijf alles in het Nederlands, zonder marketingtaal.
- Beschrijf wat er te zien is en wat het bruikbaar maakt als referentie, niet wat je ervan vindt.
- Neem bij "text" letterlijk over wat er staat, in de oorspronkelijke taal. Dat maakt het later
  vindbaar op woorden die je je nog herinnert van de pagina zelf.`;

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY ontbreekt in .env.local");
  }
  client = new Anthropic();
  return client;
}

type MediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

const SUPPORTED: string[] = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function tagImage(
  image: { data: Buffer; type: string },
  context: { sourceUrl?: string | null; notes?: string | null; title?: string | null },
): Promise<TagResult> {
  let mediaType: MediaType | null = SUPPORTED.includes(image.type)
    ? (image.type as MediaType)
    : null;
  let data = image.data;

  // Bij een opname van een hele pagina beoordelen we alleen het bovenste
  // stuk. Een pagina van tienduizend pixels indampen tot één vierkantje
  // maakt hem onleesbaar, en de stijl van een site wordt bovenin bepaald.
  const meta = await sharp(data).metadata();
  const hoogte = meta.height ?? 0;
  const breedte = meta.width ?? 0;

  if (breedte > 0 && hoogte > breedte * 2.2) {
    data = await sharp(data)
      .extract({
        left: 0,
        top: 0,
        width: breedte,
        height: Math.min(hoogte, Math.round(breedte * 1.6)),
      })
      .resize({ width: 1400, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    mediaType = "image/jpeg";
  } else if (!mediaType || data.byteLength > MAX_IMAGE_BYTES) {
    data = await sharp(data)
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    mediaType = "image/jpeg";
  }

  const hints = [
    context.title ? `Bestaande titel: ${context.title}` : null,
    context.sourceUrl ? `Bron-URL: ${context.sourceUrl}` : null,
    context.notes ? `Notitie van de eigenaar: ${context.notes}` : null,
  ].filter(Boolean);

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: {
      format: zodOutputFormat(TagResult),
      effort: "low",
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: data.toString("base64"),
            },
          },
          {
            type: "text",
            text: hints.length
              ? `Beschrijf en tag deze afbeelding.\n\n${hints.join("\n")}`
              : "Beschrijf en tag deze afbeelding.",
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Model weigerde deze afbeelding te beschrijven");
  }
  if (!response.parsed_output) {
    throw new Error("Geen bruikbaar antwoord van het model");
  }

  return response.parsed_output;
}
