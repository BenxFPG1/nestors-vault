import { listProjects } from "@/lib/notion";
import Toevoegen from "@/components/Toevoegen";

export const dynamic = "force-dynamic";

/**
 * De landingsplek van de bookmarklet. Je klikt hem aan in Safari of Chrome,
 * er springt een klein venster open met de pagina waar je stond, en met één
 * druk staat hij in de vault.
 */
export default async function ToevoegenPagina({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; titel?: string }>;
}) {
  const { url, titel } = await searchParams;
  const projecten = await listProjects();

  return <Toevoegen url={url ?? ""} titel={titel ?? ""} projecten={projecten} />;
}
