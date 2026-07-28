import Link from "next/link";
import { allItems, tagCounts } from "@/lib/store";
import { listBriefings, listProjects } from "@/lib/notion";
import { apiKey } from "@/lib/auth";
import { headers } from "next/headers";
import Briefing from "@/components/Briefing";
import RichtingPaneel from "@/components/Richting";
import Copy from "@/components/Copy";
import ProjectGrid from "@/components/ProjectGrid";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ naam: string }>;
}) {
  const { naam } = await params;
  const project = decodeURIComponent(naam);

  const [items, briefings, projects, key, headerList] = await Promise.all([
    allItems(),
    listBriefings(),
    listProjects(),
    apiKey(),
    headers(),
  ]);

  const mine = items.filter((item) => item.projects.includes(project));
  const briefing = briefings.find((entry) => entry.project === project)?.text ?? "";

  const host = headerList.get("host") ?? "localhost:3939";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;

  if (!projects.includes(project) && mine.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-mute">Dit project bestaat niet.</p>
          <Link href="/" className="mt-3 inline-block text-xs text-accent">
            terug naar de vault
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">{project}</h1>
          <p className="mt-1 text-xs text-mute">
            {mine.length} referentie{mine.length === 1 ? "" : "s"}
            {mine.length > 0 &&
              ` · ${tagCounts(mine)
                .slice(0, 4)
                .map((entry) => entry.tag)
                .join(", ")}`}
          </p>
        </div>
        <Link href="/" className="text-xs text-mute transition hover:text-accent">
          terug naar de vault
        </Link>
      </header>

      <div className="mb-10 space-y-6">
        <Briefing project={project} initial={briefing} />

        <RichtingPaneel project={project} aantal={mine.length} />

        <details className="rounded-2xl border border-line bg-surface p-4">
          <summary className="cursor-pointer text-sm text-mute">
            Dit project delen met een AI
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-xs leading-relaxed text-mute">
              Wie deze link krijgt, ziet uitsluitend dit project — de briefing en deze
              referenties, en niets anders uit je vault.
            </p>
            <Copy value={`${base}/api/mcp/${key}/p/${encodeURIComponent(project)}`} />
          </div>
        </details>
      </div>

      {mine.length === 0 ? (
        <p className="py-16 text-center text-sm text-mute">
          Nog geen referenties. Koppel ze in de vault via het detailvenster van een item.
        </p>
      ) : (
        <ProjectGrid items={mine} />
      )}
    </div>
  );
}
