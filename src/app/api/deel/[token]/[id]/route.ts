import { imageUrl } from "@/lib/notion";
import { readShareLink } from "@/lib/share";

/**
 * Beeld voor een gedeeld moodboard. Openbaar, maar alleen voor de items die
 * in de ondertekende link staan — een willekeurig ander id werkt niet.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;

  const payload = await readShareLink(token);
  if (!payload || !payload.ids.includes(id)) {
    return new Response("Niet gevonden", { status: 404 });
  }

  try {
    const source = await imageUrl(id);
    if (!source) return new Response("Geen afbeelding", { status: 404 });

    const image = await fetch(source);
    if (!image.ok || !image.body) return new Response("Niet gevonden", { status: 404 });

    return new Response(image.body, {
      headers: {
        "Content-Type": image.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Niet gevonden", { status: 404 });
  }
}
