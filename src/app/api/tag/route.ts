import { NextResponse } from "next/server";
import { imageUrl, saveTags, setStatus } from "@/lib/notion";
import { tagImage } from "@/lib/tagger";
import { allItems, invalidate } from "@/lib/store";

export const maxDuration = 60;

/**
 * Tagt items die rechtstreeks in Notion zijn toegevoegd. Per aanroep een paar
 * stuks, zodat we binnen de tijdslimiet van de host blijven; wie meer wil
 * roept gewoon nog een keer aan.
 */
const PER_RUN = 3;

async function tagBatch() {
  const items = await allItems(true);
  const todo = items
    .filter((item) => item.tags.length === 0 && item.status !== "mislukt" && item.hasImage)
    .slice(0, PER_RUN);

  let tagged = 0;
  let failed = 0;
  const log: string[] = [];

  for (const item of todo) {
    try {
      const source = await imageUrl(item.id);
      if (!source) throw new Error("geen afbeelding in Notion");

      const response = await fetch(source);
      if (!response.ok) throw new Error("afbeelding kon niet opgehaald worden");

      const result = await tagImage(
        {
          data: Buffer.from(await response.arrayBuffer()),
          type: response.headers.get("content-type") ?? "image/png",
        },
        { sourceUrl: item.sourceUrl, notes: item.notes, title: item.title },
      );

      await saveTags(item.id, result, {
        keepTitle: Boolean(item.title) && item.title !== "Nieuw item",
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

  const remaining = (await allItems(true)).filter(
    (item) => item.tags.length === 0 && item.status !== "mislukt" && item.hasImage,
  ).length;

  return { tagged, failed, remaining, log };
}

export async function POST() {
  try {
    return NextResponse.json(await tagBatch());
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
