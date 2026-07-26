import { listItems, type Item } from "./notion";
import { familiesOf, type Family } from "./colors";

/**
 * Kleine cache voor de Notion-API. Zonder dit zou elke paginaweergave
 * opnieuw de hele database ophalen; met een minuut geheugen voelt de vault
 * meteen snel en blijft hij toch actueel.
 */
const TTL_MS = 60_000;

let cache: { items: Item[]; at: number } | null = null;

export async function allItems(force = false): Promise<Item[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.items;

  const items = await listItems();
  cache = { items, at: Date.now() };
  return items;
}

export function invalidate(): void {
  cache = null;
}

const HAYSTACK = (item: Item) =>
  [item.title, item.description, item.style, item.notes, item.category, ...item.tags]
    .join(" ")
    .toLowerCase();

/**
 * Zoekt per woord in plaats van op de hele zin, zodat een vraag als
 * "donkere hero met grote typografie" ook items vindt die maar deels matchen.
 */
function tokens(search: string): string[] {
  const words = search
    .toLowerCase()
    .split(/[^\p{L}\p{N}#-]+/u)
    .filter((word) => word.length >= 3);

  // Simpele Nederlandse afkapping: "donkere" matcht ook "donker".
  return [...new Set(words.map((word) => (word.length > 5 ? word.slice(0, -1) : word)))];
}

export type Query = {
  search?: string;
  category?: string;
  tags?: string[];
  colors?: string[];
  limit?: number;
};

export function filterItems(items: Item[], query: Query = {}): Item[] {
  let result = items;

  if (query.category && query.category !== "alles") {
    result = result.filter((item) => item.category === query.category);
  }

  if (query.tags?.length) {
    result = result.filter((item) =>
      query.tags!.every((tag) => item.tags.includes(tag)),
    );
  }

  if (query.colors?.length) {
    result = result.filter((item) => {
      const families = familiesOf(item.colors) as string[];
      return query.colors!.every((family) => families.includes(family));
    });
  }

  const words = query.search?.trim() ? tokens(query.search) : [];
  if (words.length) {
    result = result
      .map((item) => {
        const haystack = HAYSTACK(item);
        return { item, score: words.filter((word) => haystack.includes(word)).length };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
  }

  return result.slice(0, query.limit ?? 500);
}

export function tagCounts(items: Item[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function colorCounts(items: Item[]): { family: Family; count: number }[] {
  const counts = new Map<Family, number>();
  for (const item of items) {
    for (const family of familiesOf(item.colors)) {
      counts.set(family, (counts.get(family) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([family, count]) => ({ family, count }))
    .sort((a, b) => b.count - a.count);
}

export function stats(items: Item[]) {
  const tagged = items.filter((item) => item.tags.length > 0).length;
  return { total: items.length, tagged, untagged: items.length - tagged };
}

/**
 * "Meer zoals dit": gedeelde tags wegen het zwaarst, daarna dezelfde
 * categorie en overlappende kleurfamilies.
 */
export function similarTo(items: Item[], target: Item, limit = 6): Item[] {
  const targetFamilies = new Set(familiesOf(target.colors));

  return items
    .filter((item) => item.id !== target.id)
    .map((item) => {
      const sharedTags = item.tags.filter((tag) => target.tags.includes(tag)).length;
      const sharedColors = familiesOf(item.colors).filter((family) =>
        targetFamilies.has(family),
      ).length;
      const sameCategory = item.category === target.category ? 1 : 0;

      return { item, score: sharedTags * 3 + sameCategory * 2 + sharedColors };
    })
    .filter((entry) => entry.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export type { Item };
