/**
 * Vaste taxonomie. De AI mag hier niet buiten kleuren — zonder deze lijst
 * ontstaat na een paar honderd items wildgroei ("donker" / "dark" / "dark-mode").
 * Uitbreiden mag, hernoemen betekent hertaggen.
 */

export const CATEGORIES = [
  "webdesign",
  "branding",
  "marketing",
  "typografie",
  "motion",
  "product",
  "print",
  "bron",
  "overig",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const TAGS = [
  // sfeer
  "minimal",
  "maximalistisch",
  "premium",
  "speels",
  "brutalist",
  "editorial",
  "retro",
  "organisch",
  "technisch",
  // kleur / licht
  "donker",
  "licht",
  "kleurrijk",
  "monochroom",
  "pastel",
  "hoog-contrast",
  // typografie
  "serif",
  "sans-serif",
  "grotesk",
  "display-type",
  "grote-typografie",
  // layout
  "raster",
  "asymmetrisch",
  "veel-witruimte",
  "dichte-layout",
  "full-bleed-beeld",
  "kaarten",
  "tabellen",
  // paginadelen
  "hero",
  "navigatie",
  "pricing",
  "footer",
  "formulier",
  "portfolio",
  "over-ons",
  "case-study",
  // marketing
  "e-mail",
  "social",
  "advertentie",
  "landingspagina",
  "copywriting",
  "hooks",
  "storytelling",
  // craft
  "illustratie",
  "fotografie",
  "3d",
  "animatie",
  "micro-interactie",
  "iconografie",
  "verpakking",
  "logo",
  // bronnen
  "galerij",
  "tutorial",
  "tool",
  "artikel",
] as const;

export type Tag = (typeof TAGS)[number];

export const STATUS = {
  NEW: "nieuw",
  TAGGED: "getagd",
  FAILED: "mislukt",
} as const;
