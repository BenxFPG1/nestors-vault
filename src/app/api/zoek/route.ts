import { NextResponse } from "next/server";
import { allItems } from "@/lib/store";
import { interpret, rank } from "@/lib/smartSearch";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { vraag } = (await request.json()) as { vraag?: string };
    if (!vraag?.trim()) {
      return NextResponse.json({ error: "Geen zoekvraag" }, { status: 400 });
    }

    const reading = await interpret(vraag);
    const items = rank(await allItems(), reading);

    return NextResponse.json({ items, reading });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Zoeken mislukt" },
      { status: 500 },
    );
  }
}
