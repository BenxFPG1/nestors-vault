import { NextResponse } from "next/server";
import { listBriefings } from "@/lib/notion";
import { allItems } from "@/lib/store";
import { maakRichting } from "@/lib/richting";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { project } = (await request.json()) as { project?: string };
  if (!project?.trim()) {
    return NextResponse.json({ error: "Geen project opgegeven." }, { status: 400 });
  }

  try {
    const items = (await allItems()).filter((item) => item.projects.includes(project));
    const briefing =
      (await listBriefings()).find((entry) => entry.project === project)?.text ?? "";

    return NextResponse.json({ richting: await maakRichting(project, briefing, items) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Richting maken mislukt" },
      { status: 500 },
    );
  }
}
