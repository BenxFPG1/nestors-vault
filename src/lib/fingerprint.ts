import sharp from "sharp";

/**
 * Een "average hash": het beeld terugbrengen tot 8×8 grijstinten en per pixel
 * onthouden of hij lichter of donkerder is dan het gemiddelde. Twee foto's van
 * dezelfde pagina leveren dan bijna dezelfde 64 bits op, ook als de ene wat
 * groter of anders gecomprimeerd is.
 *
 * Bewust geen exacte bestandsvergelijking: dan mist hij precies de gevallen
 * waar het om gaat — dezelfde site, twee keer gescreenshot.
 */
export async function fingerprint(data: Buffer): Promise<string> {
  const pixels = await sharp(data)
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  const average = [...pixels].reduce((sum, value) => sum + value, 0) / pixels.length;

  let bits = "";
  for (const value of pixels) bits += value > average ? "1" : "0";

  // Als hex, zodat het compact in een Notion-tekstveld past.
  return (
    bits
      .match(/.{4}/g)
      ?.map((nibble) => parseInt(nibble, 2).toString(16))
      .join("") ?? ""
  );
}

/** Aantal verschillende bits. Onder de 6 is het vrijwel zeker hetzelfde beeld. */
export function distance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;

  let different = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (xor) {
      different += xor & 1;
      xor >>= 1;
    }
  }
  return different;
}

export const DUPLICATE_THRESHOLD = 6;
