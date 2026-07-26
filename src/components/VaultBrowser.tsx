"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Item } from "@/lib/store";
import { familiesOf, SWATCH, type Family } from "@/lib/colors";
import AddBar from "./AddBar";
import ItemDetail from "./ItemDetail";

type Props = {
  items: Item[];
  tags: { tag: string; count: number }[];
  colors: { family: Family; count: number }[];
  projects: string[];
  categories: string[];
  counts: { total: number; tagged: number; untagged: number };
};

export default function VaultBrowser({
  items,
  tags,
  colors,
  projects,
  categories,
  counts,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("alles");
  const [category, setCategory] = useState("alles");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeColors, setActiveColors] = useState<string[]>([]);
  const [open, setOpen] = useState<Item | null>(null);
  const [tagging, setTagging] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [smart, setSmart] = useState<{ ids: string[]; vraag: string } | null>(null);
  const [thinking, setThinking] = useState(false);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Het geopende item verversen zodra de lijst opnieuw is opgehaald.
  useEffect(() => {
    if (!open) return;
    const fresh = items.find((item) => item.id === open.id);
    if (fresh && fresh !== open) setOpen(fresh);
    if (!fresh) setOpen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const byFilter = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (project !== "alles" && !item.projects.includes(project)) return false;
      if (category !== "alles" && item.category !== category) return false;
      if (!activeTags.every((tag) => item.tags.includes(tag))) return false;
      if (activeColors.length) {
        const families = familiesOf(item.colors) as string[];
        if (!activeColors.every((family) => families.includes(family))) return false;
      }
      if (!needle) return true;
      return [item.title, item.description, item.style, item.notes, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, search, project, category, activeTags, activeColors]);

  // Bij een AI-zoekopdracht bepaalt het model de volgorde, niet de filters.
  const visible = useMemo(() => {
    if (!smart) return byFilter;
    const order = new Map(smart.ids.map((id, index) => [id, index]));
    return items
      .filter((item) => order.has(item.id))
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }, [smart, byFilter, items]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const kicked = useRef(false);
  useEffect(() => {
    if (kicked.current || counts.untagged === 0) return;
    kicked.current = true;
    void tagRest(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts.untagged]);

  async function tagRest(quiet = false) {
    setTagging(true);
    if (!quiet) setNote(null);
    try {
      const response = await fetch("/api/tag", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Taggen mislukt");
      if (result.tagged > 0 || !quiet) {
        setNote(
          result.tagged === 0 && result.remaining === 0
            ? "Alles is getagd."
            : `${result.tagged} getagd${result.remaining ? `, nog ${result.remaining}` : ""}`,
        );
      }
      if (result.tagged > 0) router.refresh();
    } catch (error) {
      if (!quiet) setNote(error instanceof Error ? error.message : "Taggen mislukt");
    } finally {
      setTagging(false);
    }
  }

  async function askAi() {
    if (!search.trim()) return;
    setThinking(true);
    setNote(null);
    try {
      const response = await fetch("/api/zoek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vraag: search }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Zoeken mislukt");

      setSmart({ ids: result.items.map((item: Item) => item.id), vraag: search });
      setNote(
        result.items.length
          ? `${result.items.length} gevonden via ${result.reading.tags.slice(0, 4).join(", ") || "je vraag"}`
          : "Niks gevonden dat hierop lijkt.",
      );
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Zoeken mislukt");
    } finally {
      setThinking(false);
    }
  }

  async function newProject() {
    const name = window.prompt("Naam van het project");
    if (!name?.trim()) return;
    const response = await fetch("/api/projecten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const result = await response.json();
    if (!response.ok) {
      setNote(result.error ?? "Aanmaken mislukt");
      return;
    }
    setProject(name.trim());
    router.refresh();
  }

  async function makeShareLink() {
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selected,
          title: project !== "alles" ? project : "Moodboard",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Link maken mislukt");
      setShareUrl(result.url);
      await navigator.clipboard.writeText(result.url).catch(() => {});
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Link maken mislukt");
    }
  }

  return (
    <div className="min-h-screen pb-24 sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
          <h1 className="shrink-0 text-lg font-medium tracking-tight">Vault</h1>
          <span className="hidden shrink-0 text-xs text-mute sm:inline">
            {counts.total} items
            {counts.untagged > 0 && ` · ${counts.untagged} zonder tags`}
          </span>

          <div className="ml-auto flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <div className="flex min-w-0 flex-1 items-center rounded-full border border-line bg-surface pr-1 focus-within:border-accent sm:w-72 sm:flex-none">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSmart(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void askAi();
                }}
                placeholder="Zoek of beschrijf"
                className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm outline-none"
              />
              <button
                onClick={askAi}
                disabled={thinking || !search.trim()}
                title="Laat Claude je omschrijving begrijpen"
                className="shrink-0 rounded-full px-3 py-1.5 text-xs text-mute transition hover:text-accent disabled:opacity-40"
              >
                {thinking ? "…" : "vraag"}
              </button>
            </div>

            <button
              onClick={() => {
                setSelecting((value) => !value);
                setSelected([]);
                setShareUrl(null);
              }}
              className={`shrink-0 rounded-full border px-3 py-2.5 text-xs transition sm:px-4 sm:text-sm ${
                selecting
                  ? "border-chalk bg-chalk text-ink"
                  : "border-line hover:border-accent hover:text-accent"
              }`}
            >
              {selecting ? "klaar" : "Deel"}
            </button>

            {counts.untagged > 0 && (
              <button
                onClick={() => tagRest()}
                disabled={tagging}
                className="hidden shrink-0 rounded-full border border-line px-4 py-2.5 text-sm transition hover:border-accent hover:text-accent disabled:opacity-50 lg:block"
              >
                {tagging ? "Bezig…" : "Tag rest"}
              </button>
            )}

            <Link
              href="/instellingen"
              className="hidden shrink-0 rounded-full border border-line px-4 py-2.5 text-sm text-mute transition hover:border-accent hover:text-accent lg:block"
            >
              Instellingen
            </Link>
          </div>
        </div>

        {smart ? (
          <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 pb-3 sm:px-6">
            <span className="truncate rounded-full border border-accent px-3 py-1.5 text-xs text-accent">
              Claude zocht op: {smart.vraag}
            </span>
            <button
              onClick={() => setSmart(null)}
              className="shrink-0 text-xs text-mute transition hover:text-chalk"
            >
              wis
            </button>
          </div>
        ) : (
          <>
            <Row>
              <Pill active={project === "alles"} onClick={() => setProject("alles")}>
                Alle projecten
              </Pill>
              {projects.map((name) => (
                <Pill
                  key={name}
                  active={project === name}
                  onClick={() => setProject(name)}
                >
                  {name}
                </Pill>
              ))}
              <button
                onClick={newProject}
                className="shrink-0 rounded-full border border-dashed border-line px-3 py-2 text-xs text-mute transition hover:border-accent hover:text-accent"
              >
                + project
              </button>
            </Row>

            <Row className="pb-3">
              <Pill active={category === "alles"} onClick={() => setCategory("alles")}>
                Alles
              </Pill>
              {categories.map((name) => (
                <Pill
                  key={name}
                  active={category === name}
                  onClick={() => setCategory(name)}
                >
                  {name}
                </Pill>
              ))}

              {colors.length > 0 && (
                <span className="mx-1 h-4 w-px shrink-0 bg-line" aria-hidden />
              )}

              {colors.map(({ family, count }) => (
                <button
                  key={family}
                  onClick={() => setActiveColors((list) => toggle(list, family))}
                  title={`${family} (${count})`}
                  aria-label={`Filter op ${family}`}
                  className={`h-7 w-7 shrink-0 rounded-full border-2 transition ${
                    activeColors.includes(family)
                      ? "border-chalk"
                      : "border-line hover:border-mute"
                  }`}
                  style={{ background: SWATCH[family] }}
                />
              ))}

              {tags.length > 0 && (
                <span className="mx-1 h-4 w-px shrink-0 bg-line" aria-hidden />
              )}

              {tags.map(({ tag, count }) => (
                <Pill
                  key={tag}
                  active={activeTags.includes(tag)}
                  onClick={() => setActiveTags((list) => toggle(list, tag))}
                >
                  {tag}
                  <span className="ml-1.5 text-[10px] opacity-50">{count}</span>
                </Pill>
              ))}
            </Row>
          </>
        )}
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-8">
        {!selecting && (
          <div className={`mb-6 ${showAdd ? "" : "hidden sm:block"}`}>
            <AddBar
              onAdded={() => {
                setShowAdd(false);
                router.refresh();
              }}
            />
          </div>
        )}

        {visible.length === 0 ? (
          <Empty total={counts.total} />
        ) : (
          <div className="columns-2 gap-3 sm:gap-4 lg:columns-3 xl:columns-4">
            {visible.map((item) => (
              <Card
                key={item.id}
                item={item}
                selecting={selecting}
                checked={selected.includes(item.id)}
                onOpen={() =>
                  selecting ? setSelected((list) => toggle(list, item.id)) : setOpen(item)
                }
              />
            ))}
          </div>
        )}
      </main>

      {/* Op mobiel: één duim-bereikbare knop in plaats van de balk bovenaan. */}
      {!selecting && !open && (
        <button
          onClick={() => setShowAdd((value) => !value)}
          aria-label="Item toevoegen"
          className="fixed bottom-5 right-5 z-20 h-14 w-14 rounded-full bg-chalk text-2xl leading-none text-ink shadow-lg transition active:scale-95 sm:hidden"
        >
          {showAdd ? "×" : "+"}
        </button>
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
            <span className="text-sm text-mute">{selected.length} geselecteerd</span>
            {shareUrl && (
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-accent">
                {shareUrl} · gekopieerd
              </span>
            )}
            <button
              onClick={makeShareLink}
              disabled={selected.length === 0}
              className="ml-auto rounded-full bg-chalk px-5 py-2.5 text-sm font-medium text-ink transition active:scale-95 disabled:opacity-40"
            >
              Maak deellink
            </button>
          </div>
        </div>
      )}

      {open && (
        <ItemDetail
          item={open}
          similar={similarFrom(items, open)}
          projects={projects}
          onOpen={setOpen}
          onClose={() => setOpen(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

/** Eén rij filters die op mobiel horizontaal scrolt in plaats van afbreekt. */
function Row({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`no-scrollbar mx-auto flex max-w-[1500px] items-center gap-2 overflow-x-auto px-4 pb-2 sm:flex-wrap sm:px-6 ${className}`}
    >
      {children}
    </div>
  );
}

function similarFrom(items: Item[], target: Item): Item[] {
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
    .slice(0, 6)
    .map((entry) => entry.item);
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-2 text-xs transition ${
        active
          ? "border-chalk bg-chalk text-ink"
          : "border-line text-mute hover:border-mute hover:text-chalk"
      }`}
    >
      {children}
    </button>
  );
}

function Card({
  item,
  onOpen,
  selecting,
  checked,
}: {
  item: Item;
  onOpen: () => void;
  selecting: boolean;
  checked: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className={`mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border text-left transition active:scale-[0.99] sm:mb-4 ${
        checked ? "border-accent bg-raised" : "border-line bg-surface hover:border-mute"
      }`}
    >
      <div className="relative">
        {item.hasImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/media/${item.id}`}
            alt={item.title}
            loading="lazy"
            className="w-full"
          />
        ) : (
          <div className="flex h-32 items-center justify-center text-xs text-mute">
            geen beeld
          </div>
        )}

        {item.annotations.length > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] text-chalk">
            {item.annotations.length} ✎
          </span>
        )}

        {selecting && (
          <span
            className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
              checked
                ? "border-accent bg-accent text-ink"
                : "border-chalk/60 bg-ink/60 text-transparent"
            }`}
          >
            ✓
          </span>
        )}
      </div>

      <div className="space-y-1.5 p-2.5 sm:space-y-2 sm:p-3">
        <p className="text-[13px] leading-snug sm:text-sm">
          {item.title || "Zonder titel"}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-raised px-2 py-0.5 text-[10px] text-accent sm:text-[11px]">
            {item.category}
          </span>
          {item.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[10px] text-mute sm:text-[11px]">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function Empty({ total }: { total: number }) {
  return (
    <div className="py-24 text-center">
      <p className="text-sm text-mute">
        {total === 0
          ? "Nog niks in de vault. Voeg je eerste foto of link toe."
          : "Niks gevonden met deze filters."}
      </p>
    </div>
  );
}
