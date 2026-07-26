import { allItems, tagCounts, colorCounts, projectCounts, stats } from "@/lib/store";
import { CATEGORIES } from "@/lib/taxonomy";
import { listProjects } from "@/lib/notion";
import VaultBrowser from "@/components/VaultBrowser";

export const dynamic = "force-dynamic";

export default async function Home() {
  const items = await allItems();
  const tags = tagCounts(items).slice(0, 40);
  const colors = colorCounts(items);
  const counts = stats(items);

  // De database kent ook projecten waar nog niets aan hangt.
  const known = await listProjects();
  const used = projectCounts(items).map((entry) => entry.project);
  const projects = [...new Set([...known, ...used])].sort();

  const usedCategories = new Set(items.map((item) => item.category));
  const categories = CATEGORIES.filter((category) => usedCategories.has(category));

  return (
    <VaultBrowser
      items={items}
      tags={tags}
      colors={colors}
      projects={projects}
      categories={categories}
      counts={counts}
    />
  );
}
