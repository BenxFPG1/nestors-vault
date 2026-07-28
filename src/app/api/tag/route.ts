import { NextResponse } from "next/server";
import { imageUrl, saveTags, setStatus } from "@/lib/notion";
import { tagImage } from "@/lib/tagger";
import { allItems, invalidate } from "@/lib/store";
import { fingerprint } from "@/lib/fingerprint";

export const maxDuration = 60;

/**
 * Tagt items die rechtstreeks in Notion zijn toegevoegd. Per aanroep een paar
 * stuks, zodat we binnen de tijdslimiet van de host blijven; wie meer wil
 * roept gewoon nog een keer aan.
 */
const PER_RUN = 3;

async function tagBatch(only?: string, ookMislukte = false) {
  const items = await allItems(true);

  // Nooit geprobeerd gaat voor. Eerder mislukt komt er alleen bij als je er
  // zelf om vraagt: een item dat structureel faalt mag niet elke paginaweergave
  // en elke cron opnieuw geld kosten.
  const nieuw = items.filter(
    (item) => item.tags.length === 0 && item.status !== "mislukt" && item.hasImage,
  );
  const mislukte = ookMislukte
    ? items.filter(
        (item) => item.tags.length === 0 && item.status === "mislukt" && item.hasImage,
      )
    : [];

  const todo = only
    ? items.filter((item) => item.id === only)
    : [...nieuw, ...mislukte].slice(0, PER_RUN);

  let tagged = 0;
  let failed = 0;
  const log: string[] = [];

  for (const item of todo) {
    try {
      const source = await imageUrl(item.id);
      if (!source) throw new Error("geen afbeelding in Notion");

      const response = await fetch(source);
      if (!response.ok) throw new Error("afbeelding kon niet opgehaald worden");

      const data = Buffer.from(await response.arrayBuffer());
      const result = await tagImage(
        { data, type: response.headers.get("content-type") ?? "image/png" },
        { sourceUrl: item.sourceUrl, notes: item.notes, title: item.title },
      );

      await saveTags(item.id, result, {
        // Bij opnieuw taggen mag de titel wél opnieuw bepaald worden.
        keepTitle: !only && Boolean(item.title) && item.title !== "Nieuw item",
        fingerprint: item.fingerprint || (await fingerprint(data)),
      });
      tagged++;
      log.push(`Getagd: ${result.title}`);
    } catch (error) {
      await setStatus(item.id, "mislukt");
      failed++;
      log.push(
        `Mislukt: ${item.title || item.id} — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  invalidate();

  const verse = await allItems(true);
  const remaining = verse.filter(
    (item) =>
      item.tags.length === 0 &&
      item.hasImage &&
      (ookMislukte || item.status !== "mislukt"),
  ).length;

  return { tagged, failed, remaining, log };
}

export async function POST(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const only = params.get("item") ?? undefined;
    return NextResponse.json(await tagBatch(only, params.get("opnieuw") === "1"));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Taggen mislukt" },
      { status: 500 },
    );
  }
}

/** De dagelijkse cron van Vercel roept dit met GET aan. */
export async function GET() {
  try {
    return NextResponse.json(await tagBatch());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Taggen mislukt" },
      { status: 500 },
    );
  }
}
