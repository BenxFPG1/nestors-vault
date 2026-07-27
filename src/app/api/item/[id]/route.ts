import { NextResponse } from "next/server";
import {
  archiveItem,
  setProjects,
  setAnnotations,
  attachImage,
  saveTags,
  setStatus,
  getItem,
  type Annotation,
} from "@/lib/notion";
import { previewFor } from "@/lib/preview";
import { tagImage } from "@/lib/tagger";
import { fingerprint } from "@/lib/fingerprint";
import { invalidate } from "@/lib/store";

export const maxDuration = 60;

/** Aanpassen van één item: projecten, aantekeningen, of het beeld ophalen. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    projects?: string[];
    annotations?: Annotation[];
    refetchImage?: boolean;
  };

  try {
    if (Array.isArray(body.projects)) await setProjects(id, body.projects);
    if (Array.isArray(body.annotations)) {
      await setAnnotations(id, body.annotations.slice(0, 50));
    }

    // Opnieuw proberen bij een item waar het beeld eerder niet lukte.
    if (body.refetchImage) {
      const item = await getItem(id);
      if (!item?.sourceUrl) {
        return NextResponse.json(
          { error: "Dit item heeft geen link om een screenshot van te maken." },
          { status: 400 },
        );
      }

      const image = await previewFor(item.sourceUrl);
      if (!image) {
        return NextResponse.json(
          {
            error:
              "Geen van de screenshot-diensten gaf een beeld terug. Probeer het later nog eens, of voeg zelf een screenshot toe.",
          },
          { status: 502 },
        );
      }

      await attachImage(id, image.data, image.name, image.type);

      try {
        const result = await tagImage(image, {
          sourceUrl: item.sourceUrl,
          notes: item.notes,
          title: null,
        });
        await saveTags(id, result, { fingerprint: await fingerprint(image.data) });
      } catch (error) {
        // Beeld is binnen, taggen niet: dat is een halve winst, geen stilte waard.
        console.error("taggen na herstel mislukt:", error);
        await setStatus(id, "nieuw");
        invalidate();
        return NextResponse.json({
          item: await getItem(id),
          warning: `Screenshot opgehaald, maar taggen mislukte: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }

    invalidate();
    return NextResponse.json({ item: await getItem(id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Opslaan mislukt" },
      { status: 500 },
    );
  }
}

/** Verwijderen = archiveren in Notion, dus terug te halen uit de prullenbak. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await archiveItem(id);
    invalidate();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verwijderen mislukt" },
      { status: 500 },
    );
  }
}
