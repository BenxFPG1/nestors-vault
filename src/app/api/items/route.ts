import { NextResponse } from "next/server";
import { allItems, filterItems, tagCounts, stats } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const items = await allItems();

  return NextResponse.json({
    items: filterItems(items, {
      search: params.get("q") ?? undefined,
      category: params.get("category") ?? undefined,
      tags: params.getAll("tag"),
      limit: Number(params.get("limit")) || 200,
    }),
    tags: tagCounts(items),
    stats: stats(items),
  });
}
