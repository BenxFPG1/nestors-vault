import { NextResponse } from "next/server";
import sharp from "sharp";
import { createPage, attachImage, saveTags, setStatus, getItem } from "@/lib/notion";
import { previewFor } from "@/lib/preview";
import { tagImage } from "@/lib/tagger";
import { invalidate } from "@/lib/store";

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
      image = await previewFor(sourceUrl);
    }

    // 2. Aanmaken in Notion — de enige plek waar de vault leeft.
    const page = await createPage({
      notes,
      sourceUrl,
      fileUploadId: null,
      fileName: null,
    });
    invalidate();

    if (image) {
      await attachImage(page.id, image.data, image.name, image.type);
    } else {
      await setStatus(page.id, "mislukt");
      invalidate();
      return NextResponse.json({
        item: await getItem(page.id),
        warning: "Opgeslagen, maar er kon geen afbeelding bij deze link gevonden worden.",
      });
    }

    // 3. Taggen. Mislukt dat, dan staat het item er wél — alleen zonder tags.
    try {
      const result = await tagImage(image, { sourceUrl, notes, title: null });
      await saveTags(page.id, result);
    } catch (error) {
      await setStatus(page.id, "mislukt");
      invalidate();
      return NextResponse.json({
        item: await getItem(page.id),
        warning: `Opgeslagen, maar taggen mislukte: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }

    invalidate();
    return NextResponse.json({ item: await getItem(page.id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Toevoegen mislukt" },
      { status: 500 },
    );
  }
}
