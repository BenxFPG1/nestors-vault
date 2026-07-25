import sharp from "sharp";

/**
 * Beeld bij een losse link. Vroeger startten we hiervoor een echte browser op,
 * maar dat kan niet op gratis hosting. Nu vragen we een screenshot op bij
 * Microlink, en valt dat weg, dan pakken we de deelafbeelding van de site zelf.
 */

export type Preview = { data: Buffer; type: string; name: string };

const TIMEOUT_MS = 30_000;

async function get(url: string, accept: string): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: accept,
        // Zonder herkenbare browser-header serveren veel sites een kale pagina.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

async function normalize(response: Response, name: string): Promise<Preview | null> {
  const raw = Buffer.from(await response.arrayBuffer());
  if (raw.byteLength < 1024) return null;

  try {
    const data = await sharp(raw)
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return { data, type: "image/png", name: `${name}.png` };
  } catch {
    return null;
  }
}

async function fromScreenshotService(target: string): Promise<Preview | null> {
  const endpoint =
    "https://api.microlink.io/?url=" +
    encodeURIComponent(target) +
    "&screenshot=true&meta=false&viewport.width=1440&viewport.height=900&embed=screenshot.url";

  const response = await get(endpoint, "image/*");
  if (!response || !response.headers.get("content-type")?.startsWith("image/")) return null;
  return normalize(response, "screenshot");
}

async function fromOpenGraph(target: string): Promise<Preview | null> {
  const page = await get(target, "text/html");
  if (!page) return null;

  const html = (await page.text()).slice(0, 200_000);
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

  if (!match) return null;

  const imageUrl = new URL(match[1], target).toString();
  const image = await get(imageUrl, "image/*");
  if (!image) return null;

  return normalize(image, "voorbeeld");
}

export async function previewFor(target: string): Promise<Preview | null> {
  return (await fromScreenshotService(target)) ?? (await fromOpenGraph(target));
}
