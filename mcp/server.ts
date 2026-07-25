/**
 * MCP-server over de vault. Hiermee kan Claude (of een andere AI-client)
 * jouw eigen opgeslagen referenties zoeken en bekijken tijdens het werk.
 * Leest rechtstreeks uit Notion, dus werkt ook als de webapp niet draait.
 *
 * Registreren in Claude Code:
 *   claude mcp add vault -- npx tsx "<pad naar dit project>/mcp/server.ts"
 */
import "../scripts/env";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { imageUrl, type Item } from "../src/lib/notion";
import { allItems, filterItems, tagCounts, stats } from "../src/lib/store";
import { CATEGORIES } from "../src/lib/taxonomy";

type Block =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

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

const server = new McpServer({ name: "vault", version: "1.0.0" });

server.registerTool(
  "zoek_inspiratie",
  {
    title: "Zoek inspiratie",
    description:
      "Doorzoek de persoonlijke design-vault op opgeslagen referenties (screenshots van websites, branding, marketing). Roep dit aan wanneer om een referentie, voorbeeld, stijl of 'iets uit mijn vault' wordt gevraagd, of wanneer je een visueel voorbeeld nodig hebt voordat je iets ontwerpt.",
    inputSchema: {
      zoekterm: z
        .string()
        .optional()
        .describe("Vrije tekst, bv. 'donkere hero met grote typografie'"),
      categorie: z.enum(CATEGORIES).optional().describe("Beperk tot één categorie"),
      tags: z.array(z.string()).optional().describe("Items moeten al deze tags hebben"),
      limiet: z.number().optional().describe("Aantal resultaten, standaard 5"),
      met_beeld: z
        .boolean()
        .optional()
        .describe("Stuur de screenshots mee, standaard true"),
    },
  },
  async ({ zoekterm, categorie, tags, limiet, met_beeld }) => {
    const items = filterItems(await allItems(), {
      search: zoekterm,
      category: categorie,
      tags,
      limit: Math.min(limiet ?? 5, 12),
    });

    if (items.length === 0) {
      return { content: [{ type: "text", text: "Geen items gevonden in de vault." }] };
    }

    const content: Block[] = [];
    for (const item of items) {
      content.push(describe(item));
      if (met_beeld !== false) {
        const image = await imageBlock(item);
        if (image) content.push(image);
      }
    }
    return { content };
  },
);

server.registerTool(
  "toon_item",
  {
    title: "Toon item",
    description:
      "Haal één item uit de vault op inclusief screenshot, op basis van het id uit zoek_inspiratie.",
    inputSchema: { id: z.string().describe("Item-id uit zoek_inspiratie") },
  },
  async ({ id }) => {
    const item = (await allItems()).find((entry) => entry.id === id);
    if (!item) {
      return { content: [{ type: "text", text: `Geen item met id ${id}.` }] };
    }

    const content: Block[] = [describe(item)];
    const image = await imageBlock(item);
    if (image) content.push(image);
    return { content };
  },
);

server.registerTool(
  "vault_overzicht",
  {
    title: "Vault-overzicht",
    description:
      "Laat zien wat er in de vault zit: aantal items en welke tags er bestaan. Handig om te bepalen waarop je kunt zoeken.",
    inputSchema: {},
  },
  async () => {
    const items = await allItems();
    const counts = stats(items);
    return {
      content: [
        {
          type: "text",
          text: [
            `${counts.total} items (${counts.tagged} getagd, ${counts.untagged} nog niet).`,
            "",
            "Categorieën: " + CATEGORIES.join(", "),
            "",
            "Tags in gebruik:",
            tagCounts(items)
              .map(({ tag, count }) => `  ${tag} (${count})`)
              .join("\n") || "  —",
          ].join("\n"),
        },
      ],
    };
  },
);

await server.connect(new StdioServerTransport());
