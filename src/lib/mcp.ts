import { NextResponse } from "next/server";
import { imageUrl, listBriefings, type Item } from "./notion";
import { allItems, filterItems, tagCounts, stats } from "./store";
import { interpret, rank } from "./smartSearch";
import { CATEGORIES } from "./taxonomy";
import { FAMILIES } from "./colors";

/**
 * De vault-gereedschappen voor AI-clients, over gewone HTTP.
 *
 * Handmatig geschreven JSON-RPC in plaats van een SDK: het zijn drie
 * methodes op één POST, en zo zit er niets tussen dat kan verouderen.
 *
 * `scope` beperkt alles tot één project. Een link met een project erin laat
 * de AI dus letterlijk niets anders zien — handig als je met een klant of
 * een externe werkt en niet je hele archief wilt openleggen.
 */

type Block =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export function toolsFor(scope: string | null) {
  const where = scope ? ` Beperkt tot het project "${scope}".` : "";

  return [
    {
      name: "zoek_inspiratie",
      description:
        `Doorzoek de design-vault van Nestors Create op opgeslagen referenties (screenshots van websites, branding, marketing).${where} Roep dit aan wanneer om een referentie, voorbeeld of stijl wordt gevraagd, of wanneer je een visueel voorbeeld nodig hebt voordat je iets ontwerpt. Begrijpt ook vage vragen als 'iets met een rustige premium uitstraling'.`,
      inputSchema: {
        type: "object",
        properties: {
          zoekterm: { type: "string", description: "Vrije omschrijving van wat je zoekt" },
          categorie: { type: "string", enum: CATEGORIES as unknown as string[] },
          tags: { type: "array", items: { type: "string" } },
          kleur: { type: "string", enum: FAMILIES as unknown as string[] },
          limiet: { type: "number", description: "Aantal resultaten, standaard 5" },
          met_beeld: {
            type: "boolean",
            description: "Screenshots meesturen, standaard true",
          },
        },
      },
    },
    {
      name: "toon_item",
      description:
        "Haal één item op inclusief screenshot, aantekeningen en opmerkingen, op basis van het id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    {
      name: "vault_overzicht",
      description: `Laat zien wat er beschikbaar is: aantal items en welke tags bestaan.${where}`,
      inputSchema: { type: "object", properties: {} },
    },
  ];
}

function describe(item: Item): Block {
  const notes = item.annotations.map((note) =>
    note.box
      ? `  • [op het beeld] ${note.text}`
      : `  • ${note.text}`,
  );

  return {
    type: "text",
    text: [
      `# ${item.title || "Zonder titel"}  (id: ${item.id})`,
      `categorie: ${item.category}`,
      `tags: ${item.tags.join(", ") || "—"}`,
      item.projects.length ? `projecten: ${item.projects.join(", ")}` : null,
      item.colors.length ? `kleuren: ${item.colors.join(", ")}` : null,
      item.style ? `stijl: ${item.style}` : null,
      item.description ? `beschrijving: ${item.description}` : null,
      item.text ? `tekst in beeld: ${item.text}` : null,
      item.notes ? `notitie: ${item.notes}` : null,
      notes.length ? `opmerkingen van de eigenaar:\n${notes.join("\n")}` : null,
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

async function scopedItems(scope: string | null): Promise<Item[]> {
  const items = await allItems();
  return scope ? items.filter((item) => item.projects.includes(scope)) : items;
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  scope: string | null,
) {
  const items = await scopedItems(scope);

  if (name === "vault_overzicht") {
    const counts = stats(items);

    // Bij een projectlink hoort de briefing erbij: die vertelt waaróm deze
    // referenties bij elkaar staan.
    let briefing = "";
    if (scope) {
      const found = (await listBriefings()).find((entry) => entry.project === scope);
      if (found?.text) briefing = `\nBriefing:\n${found.text}\n`;
    }

    return {
      content: [
        {
          type: "text",
          text: [
            scope ? `Project: ${scope}` : "Volledige vault",
            briefing,
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
      return {
        content: [
          {
            type: "text",
            text: scope
              ? `Geen item met id ${args.id} binnen project ${scope}.`
              : `Geen item met id ${args.id}.`,
          },
        ],
      };
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
      if (found.length === 0) found = filterItems(items, { search: zoekterm, limit });
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
      return {
        content: [
          {
            type: "text",
            text: scope
              ? `Geen items gevonden binnen project ${scope}.`
              : "Geen items gevonden in de vault.",
          },
        ],
      };
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

export async function handleMcp(request: Request, scope: string | null) {
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
          serverInfo: { name: scope ? `vault: ${scope}` : "vault", version: "1.1.0" },
        });

      case "notifications/initialized":
        return new Response(null, { status: 204 });

      case "ping":
        return reply({});

      case "tools/list":
        return reply({ tools: toolsFor(scope) });

      case "tools/call":
        return reply(
          await callTool(
            message.params?.name as string,
            (message.params?.arguments ?? {}) as Record<string, unknown>,
            scope,
          ),
        );

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
