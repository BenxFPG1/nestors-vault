import sharp from "sharp";

/**
 * Beeld bij een losse link. Vroeger startten we hiervoor een echte browser op,
 * maar dat kan niet op gratis hosting.
 *
 * We proberen meerdere screenshot-diensten achter elkaar. Dat is geen
 * overdaad: gratis diensten kijken naar het IP-adres van de aanvrager, en
 * Vercel deelt die adressen met duizenden anderen. Wat vanaf je eigen Mac
 * prima werkt, kan vanaf de server geweigerd worden — dus één dienst is te
 * wankel om je vault op te bouwen.
 */

export type Preview = { data: Buffer; type: string; name: string; via: string };

const TIMEOUT_MS = 14_000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/** Kleiner dan dit is geen screenshot maar een grijze placeholder of een foutplaatje. */
const MIN_BYTES = 20_000;

async function get(url: string, accept: string): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: accept, "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

async function asImage(
  response: Response | null,
  name: string,
  via: string,
  minBytes = MIN_BYTES,
  fullPage = false,
): Promise<Preview | null> {
  if (!response) return null;
  if (!response.headers.get("content-type")?.startsWith("image/")) return null;

  const raw = Buffer.from(await response.arrayBuffer());
  if (raw.byteLength < minBytes) return null;

  try {
    // JPEG in plaats van PNG: een screenshot van 2880 breed levert als PNG
    // zo een paar megabyte op, en dat moet daarna nog naar Notion én naar
    // het model. Op kwaliteit 88 zie je het verschil niet.
    // Een hele pagina mag lang zijn, maar niet eindeloos: boven de 8000 pixels
    // wordt het bestand onwerkbaar en kan het model er niets meer mee.
    const data = await sharp(raw)
      .resize(
        fullPage
          ? // Alleen de breedte begrenzen: de hoogte ís hier de inhoud.
            { width: 1200, height: 24_000, fit: "inside", withoutEnlargement: true }
          : { width: 2000, height: 2000, fit: "inside", withoutEnlargement: true },
      )
      .jpeg({ quality: fullPage ? 78 : 88 })
      .toBuffer();

    return { data, type: "image/jpeg", name: `${name}.jpg`, via };
  } catch {
    return null;
  }
}

/* ── De diensten, in volgorde van kwaliteit ───────────────────────────── */

async function viaMicrolink(target: string, fullPage: boolean): Promise<Preview | null> {
  const url =
    "https://api.microlink.io/?url=" +
    encodeURIComponent(target) +
    "&screenshot=true&meta=false&viewport.width=1440&viewport.height=900" +
    (fullPage ? "&screenshot.fullPage=true" : "") +
    "&embed=screenshot.url";

  return asImage(await get(url, "image/*"), "screenshot", "microlink", MIN_BYTES, fullPage);
}

async function viaThumIo(target: string, fullPage: boolean): Promise<Preview | null> {
  const url = fullPage
    ? `https://image.thum.io/get/width/1440/fullpage/noanimate/${target}`
    : `https://image.thum.io/get/width/1440/crop/1000/noanimate/${target}`;

  return asImage(await get(url, "image/*"), "screenshot", "thum.io", MIN_BYTES, fullPage);
}

/** De deelafbeelding die de site zelf meegeeft. */
async function viaOpenGraph(target: string): Promise<Preview | null> {
  const page = await get(target, "text/html");
  if (!page) return null;

  const html = (await page.text()).slice(0, 300_000);
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

  if (!match) return null;

  const imageUrl = new URL(match[1], target).toString();
  return asImage(await get(imageUrl, "image/*"), "voorbeeld", "og:image", 8_000);
}

/**
 * Laatste redmiddel: de grootste afbeelding op de pagina zelf. Bij
 * portfolio- en studiosites is dat vrijwel altijd het hero-beeld.
 */
async function viaGrootsteAfbeelding(target: string): Promise<Preview | null> {
  const page = await get(target, "text/html");
  if (!page) return null;

  const html = (await page.text()).slice(0, 300_000);
  const kandidaten = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((src) => !src.startsWith("data:"))
    .slice(0, 6);

  let beste: Preview | null = null;
  for (const src of kandidaten) {
    try {
      const absolute = new URL(src, target).toString();
      const found = await asImage(
        await get(absolute, "image/*"),
        "beeld van de pagina",
        "pagina",
        30_000,
      );
      if (found && (!beste || found.data.byteLength > beste.data.byteLength)) {
        beste = found;
        // Groot genoeg om een hero te zijn; verder zoeken kost alleen tijd.
        if (beste.data.byteLength > 120_000) break;
      }
    } catch {
      // stuk kapotte URL, gewoon door
    }
  }
  return beste;
}

export async function previewFor(
  target: string,
  options: { fullPage?: boolean } = {},
): Promise<Preview | null> {
  const fullPage = options.fullPage ?? false;

  // Voor een hele pagina staat thum.io voorop: Microlink levert daar in de
  // praktijk alsnog één scherm. Voor een gewone opname is Microlink beter.
  const routes = fullPage
    ? [
        () => viaThumIo(target, true),
        () => viaMicrolink(target, false),
        () => viaOpenGraph(target),
        () => viaGrootsteAfbeelding(target),
      ]
    : [
        () => viaMicrolink(target, false),
        () => viaThumIo(target, false),
        () => viaOpenGraph(target),
        () => viaGrootsteAfbeelding(target),
      ];

  // De twee screenshot-diensten tegelijk aanspreken in plaats van na elkaar.
  // Vroeger wachtten we tot de eerste opgaf voordat de tweede begon; bij een
  // trage dienst kostte dat een halve minuut. Nu telt wie het eerst klaar is,
  // met voorrang voor de dienst die bovenaan staat.
  const [voorkeur, reserve, ...rest] = routes;

  const uitkomsten = await Promise.allSettled([voorkeur(), reserve()]);
  for (const uitkomst of uitkomsten) {
    if (uitkomst.status === "fulfilled" && uitkomst.value) return uitkomst.value;
  }

  // Beide diensten weigerden: dan alsnog de pagina zelf uitpluizen.
  for (const route of rest) {
    const found = await route();
    if (found) return found;
  }
  return null;
}
