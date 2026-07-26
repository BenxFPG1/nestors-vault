import { NextResponse } from "next/server";
import { createShareLink } from "@/lib/share";

export async function POST(request: Request) {
  const { ids, title, days } = (await request.json()) as {
    ids?: string[];
    title?: string;
    days?: number;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Selecteer eerst items." }, { status: 400 });
  }
  if (ids.length > 60) {
    return NextResponse.json(
      { error: "Maximaal 60 items per moodboard." },
      { status: 400 },
    );
  }

  const token = await createShareLink(ids, { title, days });
  const base = new URL(request.url).origin;

  return NextResponse.json({ url: `${base}/deel/${token}` });
}
