/**
 * De tagger slaat hex-kleuren op. Hier vertalen we die naar een handvol
 * families, zodat je op kleur kunt filteren zonder honderd bijna-gelijke
 * stalen naast elkaar te krijgen.
 */

export const FAMILIES = [
  "zwart",
  "wit",
  "grijs",
  "rood",
  "oranje",
  "geel",
  "groen",
  "blauw",
  "paars",
  "roze",
  "bruin",
] as const;

export type Family = (typeof FAMILIES)[number];

/** Representatieve staal per familie, voor de knopjes in de interface. */
export const SWATCH: Record<Family, string> = {
  zwart: "#111113",
  wit: "#F5F3EE",
  grijs: "#8D8B85",
  rood: "#C0392B",
  oranje: "#D2691E",
  geel: "#D4A017",
  groen: "#4E8B4A",
  blauw: "#3B6FB5",
  paars: "#6B4FA0",
  roze: "#C86A93",
  bruin: "#7A5230",
};

export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;

  let value = match[1];
  if (value.length === 3) {
    value = value
      .split("")
      .map((char) => char + char)
      .join("");
  }

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function toHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l: lightness };

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue: number;
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
  else if (max === green) hue = ((blue - red) / delta + 2) / 6;
  else hue = ((red - green) / delta + 4) / 6;

  return { h: hue * 360, s: saturation, l: lightness };
}

export function familyOf(hex: string): Family | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const { h, s, l } = toHsl(rgb.r, rgb.g, rgb.b);

  // Eerst de kleurloze gevallen: die domineren in webdesign.
  if (l < 0.12) return "zwart";
  if (l > 0.92 && s < 0.18) return "wit";
  if (s < 0.15) return "grijs";

  // Bruin is donker oranje — zonder deze uitzondering wordt alles "oranje".
  if (h >= 15 && h < 45 && l < 0.42) return "bruin";

  if (h < 15 || h >= 345) return "rood";
  if (h < 45) return "oranje";
  if (h < 70) return "geel";
  if (h < 165) return "groen";
  if (h < 255) return "blauw";
  if (h < 290) return "paars";
  return "roze";
}

export function familiesOf(colors: string[]): Family[] {
  const found = new Set<Family>();
  for (const color of colors) {
    const family = familyOf(color);
    if (family) found.add(family);
  }
  return [...found];
}
