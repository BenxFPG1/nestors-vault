import { NextResponse } from "next/server";
import {
  archiveItem,
  setProjects,
  setAnnotations,
  getItem,
  type Annotation,
} from "@/lib/notion";
import { invalidate } from "@/lib/store";

/** Aanpassen van één item: projecten koppelen of aantekeningen bijwerken. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    projects?: string[];
    annotations?: Annotation[];
  };

  try {
    if (Array.isArray(body.projects)) await setProjects(id, body.projects);
    if (Array.isArray(body.annotations)) {
      await setAnnotations(id, body.annotations.slice(0, 50));
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
