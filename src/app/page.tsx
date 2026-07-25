import { allItems, tagCounts, stats } from "@/lib/store";
import { CATEGORIES } from "@/lib/taxonomy";
import VaultBrowser from "@/components/VaultBrowser";

export const dynamic = "force-dynamic";

export default async function Home() {
  const items = await allItems();
  const tags = tagCounts(items).slice(0, 40);
  const counts = stats(items);

  const used = new Set(items.map((item) => item.category));
  const categories = CATEGORIES.filter((category) => used.has(category));

  return (
    <VaultBrowser items={items} tags={tags} categories={categories} counts={counts} />
  );
}
