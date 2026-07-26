import { NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/notion";
import { invalidate } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ projects: await listProjects() });
}

export async function POST(request: Request) {
  const { name } = (await request.json()) as { name?: string };
  const clean = name?.trim().slice(0, 60);

  if (!clean) {
    return NextResponse.json({ error: "Geef het project een naam." }, { status: 400 });
  }
  // Komma's breken Notion's multi-select op in losse waarden.
  if (clean.includes(",")) {
    return NextResponse.json(
      { error: "Een projectnaam mag geen komma bevatten." },
      { status: 400 },
    );
  }

  try {
    await createProject(clean);
    invalidate();
    return NextResponse.json({ projects: await listProjects() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Aanmaken mislukt" },
      { status: 500 },
    );
  }
}
