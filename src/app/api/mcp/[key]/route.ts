import { NextResponse } from "next/server";
import { isValidApiKey } from "@/lib/auth";
import { imageUrl, type Item } from "@/lib/notion";
import { allItems, filterItems, tagCounts, stats } from "@/lib/store";
import { interpret, rank } from "@/lib/smartSearch";
import { CATEGORIES } from "@/lib/taxonomy";
import { FAMILIES } from "@/lib/colors";

/**
 * Dezelfde vault-gereedschappen als de lokale MCP-server, maar over HTTP.
 * De sleutel zit in het pad, omdat MCP-clients zelden losse headers kunnen
 * meesturen. Zonder geldige sleutel bestaat dit eindpunt simpelweg niet.
 *
 * Handmatig geschreven JSON-RPC in plaats van een SDK: het is één POST met
 * drie methodes, en zo blijft er niets tussen zitten dat kan verouderen.
 */

export const maxDuration = 60;

type Block =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

const TOOLS = [
  {
    name: "zoek_inspiratie",
    description:
      "Doorzoek de persoonlijke design-vault van Nestors Create op opgeslagen referenties (screenshots van websites, branding, marketing). Roep dit aan wanneer om een referentie, voorbeeld of stijl wordt gevraagd, of wanneer je een visueel voorbeeld nodig hebt voordat je iets ontwerpt. Begrijpt ook vage vragen als 'iets met een rustige premium uitstraling'.",
    inputSchema: {
      type: "object",
      properties: {
        zoekterm: { type: "string", description: "Vrije omschrijving van wat je zoekt" },
        categorie: { type: "string", enum: CATEGORIES as unknown as string[] },
        tags: { type: "array", items: { type: "string" } },
        kleur: { type: "string", enum: FAMILIES as unknown as string[] },
        limiet: { type: "number", description: "Aantal resultaten, standaard 5" },
        met_beeld: { type: "boolean", description: "Screenshots meesturen, standaard true" },
      },
    },
  },
  {
    name: "toon_item",
    description: "Haal één item uit de vault op inclusief screenshot, op basis van het id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "vault_overzicht",
    description:
      "Laat zien wat er in de vault zit: aantal items en welke tags er bestaan. Handig om te bepalen waarop je kunt zoeken.",
    inputSchema: { type: "object", properties: {} },
  },
];

function describe(item: Item): Block {
  return {
    type: "text",
    text: [
      `# ${item.title || "Zonder titel"}  (id: ${item.id})`,
      `categorie: ${item.category}`,
      `tags: ${item.tags.join(", ") || "—"}`,
      item.colors.length ? `kleuren: ${item.colors.join(", ")}` : null,
      item.style ? `stijl: ${item.style}` : null,
      item.description ? `beschrijving: ${item.description}` : null,
      item.notes ? `notitie: ${item.notes}` : null,
      item.sourceUrl ? `bron: ${item.sourceUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function imageBlock(item: Item): Promise<Block | null> {
  if (!item.hasImage) return null;
  try {
    const source = await imageUrl(item.id);
    if (!source) return null;
    const response = await fetch(source);
    if (!response.ok) return null;
    return {
      type: "image",
      data: Buffer.from(await response.arrayBuffer()).toString("base64"),
      mimeType: response.headers.get("content-type") ?? "image/png",
    };
  } catch {
    return null;
  }
}

async function callTool(name: string, args: Record<string, unknown>) {
  const items = await allItems();

  if (name === "vault_overzicht") {
    const counts = stats(items);
    return {
      content: [
        {
          type: "text",
          text: [
            `${counts.total} items (${counts.tagged} getagd, ${counts.untagged} nog niet).`,
            "",
            `Categorieën: ${CATEGORIES.join(", ")}`,
            `Kleuren: ${FAMILIES.join(", ")}`,
            "",
            "Tags in gebruik:",
            tagCounts(items)
              .map(({ tag, count }) => `  ${tag} (${count})`)
              .join("\n") || "  —",
          ].join("\n"),
        },
      ],
    };
  }

  if (name === "toon_item") {
    const item = items.find((entry) => entry.id === args.id);
    if (!item) {
      return { content: [{ type: "text", text: `Geen item met id ${args.id}.` }] };
    }
    const content: Block[] = [describe(item)];
    const image = await imageBlock(item);
    if (image) content.push(image);
    return { content };
  }

  if (name === "zoek_inspiratie") {
    const limit = Math.min(Number(args.limiet) || 5, 12);
    const zoekterm = typeof args.zoekterm === "string" ? args.zoekterm : "";

    let found: Item[];
    if (zoekterm.trim()) {
      // Eerst de vraag laten begrijpen; valt dat om, dan gewoon op woorden.
      try {
        found = rank(items, await interpret(zoekterm), limit);
      } catch {
        found = [];
      }
      if (found.length === 0) {
        found = filterItems(items, { search: zoekterm, limit });
      }
    } else {
      found = items;
    }

    found = filterItems(found, {
      category: typeof args.categorie === "string" ? args.categorie : undefined,
      tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
      colors: typeof args.kleur === "string" ? [args.kleur] : undefined,
      limit,
    });

    if (found.length === 0) {
      return { content: [{ type: "text", text: "Geen items gevonden in de vault." }] };
    }

    const content: Block[] = [];
    for (const item of found) {
      content.push(describe(item));
      if (args.met_beeld !== false) {
        const image = await imageBlock(item);
        if (image) content.push(image);
      }
    }
    return { content };
  }

  throw new Error(`Onbekend gereedschap: ${name}`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!(await isValidApiKey(key))) {
    return new Response("Niet gevonden", { status: 404 });
  }

  const message = (await request.json()) as {
    id?: number | string | null;
    method?: string;
    params?: Record<string, unknown>;
  };

  const reply = (result: unknown) =>
    NextResponse.json({ jsonrpc: "2.0", id: message.id ?? null, result });

  try {
    switch (message.method) {
      case "initialize":
        return reply({
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "vault", version: "1.0.0" },
        });

      case "notifications/initialized":
        return new Response(null, { status: 204 });

      case "ping":
        return reply({});

      case "tools/list":
        return reply({ tools: TOOLS });

      case "tools/call": {
        const name = message.params?.name as string;
        const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
        return reply(await callTool(name, args));
      }

      default:
        return NextResponse.json({
          jsonrpc: "2.0",
          id: message.id ?? null,
          error: { code: -32601, message: `Onbekende methode: ${message.method}` },
        });
    }
  } catch (error) {
    return NextResponse.json({
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Interne fout",
      },
    });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!(await isValidApiKey(key))) return new Response("Niet gevonden", { status: 404 });

  // Sommige clients pingen eerst met GET om te kijken of het eindpunt leeft.
  return NextResponse.json({ name: "vault", transport: "streamable-http", tools: TOOLS.length });
}
