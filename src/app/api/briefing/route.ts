import { NextResponse } from "next/server";
import { listBriefings, saveBriefing } from "@/lib/notion";

export async function GET() {
  return NextResponse.json({ briefings: await listBriefings() });
}

export async function POST(request: Request) {
  const { project, text } = (await request.json()) as {
    project?: string;
    text?: string;
  };

  if (!project?.trim()) {
    return NextResponse.json({ error: "Geen project opgegeven." }, { status: 400 });
  }

  try {
    await saveBriefing(project.trim(), text ?? "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Opslaan mislukt" },
      { status: 500 },
    );
  }
}
