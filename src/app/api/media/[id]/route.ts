import { imageUrl } from "@/lib/notion";

/**
 * Afbeeldingen komen uit Notion. De URL's daarvan verlopen na ongeveer een uur,
 * dus we halen er telkens een verse op en sturen het beeld zelf door. De
 * browser mag het daarna een uur bewaren, zodat scrollen niet telkens opnieuw
 * Notion belast.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const source = await imageUrl(id);
    if (!source) return new Response("Geen afbeelding", { status: 404 });

    const image = await fetch(source);
    if (!image.ok || !image.body) return new Response("Niet gevonden", { status: 404 });

    return new Response(image.body, {
      headers: {
        "Content-Type": image.headers.get("content-type") ?? "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Niet gevonden", { status: 404 });
  }
}
