import { NextResponse, after } from "next/server";
import sharp from "sharp";
import { createPage, attachImage, saveTags, setStatus, getItem } from "@/lib/notion";
import { previewFor } from "@/lib/preview";
import { tagImage } from "@/lib/tagger";
import { startTagWorkflow } from "@/lib/github";
import { allItems, invalidate } from "@/lib/store";
import { fingerprint, distance, DUPLICATE_THRESHOLD } from "@/lib/fingerprint";

export const maxDuration = 60;

const KEEP: Record<string, { ext: string; type: string }> = {
  png: { ext: ".png", type: "image/png" },
  jpeg: { ext: ".jpg", type: "image/jpeg" },
  webp: { ext: ".webp", type: "image/webp" },
  gif: { ext: ".gif", type: "image/gif" },
};

/**
 * Telefoons sturen soms HEIC of een ander formaat waar de rest van de keten
 * niets mee kan. Alles wat we niet herkennen gaat naar JPEG.
 */
async function normalize(input: Buffer) {
  const format = (await sharp(input).metadata()).format ?? "";
  const known = KEEP[format];
  if (known) return { data: input, ...known };

  const data = await sharp(input)
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  return { data, ext: ".jpg", type: "image/jpeg" };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const upload = form.get("file");
    const sourceUrl = (form.get("url") as string | null)?.trim() || null;
    const notes = (form.get("notes") as string | null)?.trim() || "";

    const hasFile = upload instanceof File && upload.size > 0;
    if (!hasFile && !sourceUrl) {
      return NextResponse.json({ error: "Voeg een afbeelding of een link toe." }, { status: 400 });
    }
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      return NextResponse.json(
        { error: "Een link moet met http:// of https:// beginnen." },
        { status: 400 },
      );
    }

    // 1. Beeld bepalen: het geüploade bestand, of een voorbeeld van de link.
    let image: { data: Buffer; type: string; name: string } | null = null;

    if (hasFile) {
      const file = upload as File;
      const normalized = await normalize(Buffer.from(await file.arrayBuffer()));
      image = {
        data: normalized.data,
        type: normalized.type,
        name: file.name || `upload${normalized.ext}`,
      };
    } else if (sourceUrl) {
      image = await previewFor(sourceUrl, { fullPage: form.get("fullPage") === "1" });
    }

    // 2. Al eens opgeslagen? Twee screenshots van dezelfde pagina zien er
    //    zelden byte-voor-byte gelijk uit, dus we vergelijken op vingerafdruk.
    let print = "";
    if (image) {
      print = await fingerprint(image.data);
      const twin = (await allItems()).find(
        (entry) =>
          entry.fingerprint && distance(entry.fingerprint, print) < DUPLICATE_THRESHOLD,
      );

      if (twin && form.get("force") !== "1") {
        return NextResponse.json(
          {
            duplicate: {
              id: twin.id,
              title: twin.title,
              createdAt: twin.createdAt,
            },
            error: `Dit lijkt op "${twin.title || "een item"}" dat je al hebt.`,
          },
          { status: 409 },
        );
      }
    }

    // 3. Aanmaken in Notion — de enige plek waar de vault leeft.
    const page = await createPage({
      notes,
      sourceUrl,
      fileUploadId: null,
      fileName: null,
    });
    invalidate();

    if (!image) {
      await setStatus(page.id, "mislukt");
      invalidate();
      return NextResponse.json({
        item: await getItem(page.id),
        warning: "Opgeslagen, maar er kon geen afbeelding bij deze link gevonden worden.",
      });
    }

    await attachImage(page.id, image.data, image.name, image.type);
    invalidate();

    // 4. Beschrijven: eerst de GitHub-workflow proberen (draait op het
    //    Claude-abonnement, kost geen API-tegoed). Pas als die niet is
    //    ingesteld valt het terug op direct taggen via de API.
    const viaActions = await startTagWorkflow();

    if (!viaActions) {
      const beschrijving = tagImage(image, { sourceUrl, notes, title: null });
      // Zonder deze vangnet-regel valt de server om op een afwijzing die pas
      // later wordt opgepakt.
      beschrijving.catch(() => {});

      // Antwoord nu al terug: je ziet de kaart meteen staan. Het beschrijven
      // loopt door nadat het antwoord verstuurd is, en schrijft zichzelf weg.
      after(async () => {
        try {
          await saveTags(page.id, await beschrijving, { fingerprint: print });
        } catch {
          await setStatus(page.id, "mislukt");
        }
        invalidate();
      });
    }

    return NextResponse.json({
      item: await getItem(page.id),
      tagging: true,
      // De workflow doet er een paar minuten over; direct taggen ~20 seconden.
      via: viaActions ? "actions" : "api",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Toevoegen mislukt" },
      { status: 500 },
    );
  }
}
