"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Item } from "@/lib/store";
import { familiesOf, SWATCH, type Family } from "@/lib/colors";
import AddBar from "./AddBar";

type Props = {
  items: Item[];
  tags: { tag: string; count: number }[];
  colors: { family: Family; count: number }[];
  categories: string[];
  counts: { total: number; tagged: number; untagged: number };
};

export default function VaultBrowser({
  items,
  tags,
  colors,
  categories,
  counts,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("alles");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeColors, setActiveColors] = useState<string[]>([]);
  const [open, setOpen] = useState<Item | null>(null);
  const [tagging, setTagging] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const [smart, setSmart] = useState<{ ids: string[]; vraag: string } | null>(null);
  const [thinking, setThinking] = useState(false);

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const byWord = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
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
  }, [items, search, category, activeTags, activeColors]);

  // Bij een AI-zoekopdracht bepaalt het model de volgorde, niet de filters.
  const visible = useMemo(() => {
    if (!smart) return byWord;
    const order = new Map(smart.ids.map((id, index) => [id, index]));
    return items
      .filter((item) => order.has(item.id))
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }, [smart, byWord, items]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  // Achterstand automatisch wegwerken zodra je de vault opent.
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

  async function makeShareLink() {
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, title: "Moodboard" }),
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
          <h1 className="text-lg font-medium tracking-tight">Vault</h1>
          <span className="text-xs text-mute">
            {counts.total} items
            {counts.untagged > 0 && ` · ${counts.untagged} nog zonder tags`}
          </span>

          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto sm:gap-3">
            {note && <span className="hidden text-xs text-mute lg:inline">{note}</span>}

            <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-line bg-surface pr-1 focus-within:border-accent sm:w-72 sm:flex-none">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setSmart(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void askAi();
                }}
                placeholder="Zoek, of beschrijf wat je zoekt"
                className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm outline-none"
              />
              <button
                onClick={askAi}
                disabled={thinking || !search.trim()}
                title="Laat Claude je omschrijving begrijpen"
                className="shrink-0 rounded-full px-3 py-1 text-xs text-mute transition hover:text-accent disabled:opacity-40"
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
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
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
                className="hidden shrink-0 rounded-full border border-line px-4 py-2 text-sm transition hover:border-accent hover:text-accent disabled:opacity-50 sm:block"
              >
                {tagging ? "Bezig…" : "Tag rest"}
              </button>
            )}

            <Link
              href="/instellingen"
              className="hidden shrink-0 rounded-full border border-line px-4 py-2 text-sm text-mute transition hover:border-accent hover:text-accent sm:block"
            >
              Instellingen
            </Link>
          </div>
        </div>

        {smart ? (
          <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 pb-4 sm:px-6">
            <span className="rounded-full border border-accent px-3 py-1.5 text-xs text-accent">
              Claude zocht op: {smart.vraag}
            </span>
            <button
              onClick={() => setSmart(null)}
              className="text-xs text-mute transition hover:text-chalk"
            >
              wis
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2 px-4 pb-4 sm:px-6">
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

            {colors.length > 0 && <span className="mx-1 h-4 w-px bg-line" aria-hidden />}

            {colors.map(({ family, count }) => (
              <button
                key={family}
                onClick={() => setActiveColors((list) => toggle(list, family))}
                title={`${family} (${count})`}
                aria-label={`Filter op ${family}`}
                className={`h-6 w-6 shrink-0 rounded-full border-2 transition ${
                  activeColors.includes(family)
                    ? "border-chalk"
                    : "border-line hover:border-mute"
                }`}
                style={{ background: SWATCH[family] }}
              />
            ))}

            {tags.length > 0 && <span className="mx-1 h-4 w-px bg-line" aria-hidden />}

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
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
        {!selecting && (
          <div className="mb-6">
            <AddBar onAdded={() => router.refresh()} />
          </div>
        )}

        {visible.length === 0 ? (
          <Empty total={counts.total} />
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {visible.map((item) => (
              <Card
                key={item.id}
                item={item}
                selecting={selecting}
                checked={selected.includes(item.id)}
                onOpen={() =>
                  selecting
                    ? setSelected((list) => toggle(list, item.id))
                    : setOpen(item)
                }
              />
            ))}
          </div>
        )}
      </main>

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
            <span className="text-sm text-mute">
              {selected.length} geselecteerd voor een moodboard
            </span>
            {shareUrl && (
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-accent">
                {shareUrl} · gekopieerd
              </span>
            )}
            <button
              onClick={makeShareLink}
              disabled={selected.length === 0}
              className="ml-auto rounded-full bg-chalk px-5 py-2 text-sm font-medium text-ink transition hover:opacity-90 disabled:opacity-40"
            >
              Maak deellink
            </button>
          </div>
        </div>
      )}

      {open && (
        <Detail
          item={open}
          similar={similarFrom(items, open)}
          onOpen={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

/** Zelfde logica als op de server, maar hier zonder extra netwerkverkeer. */
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
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
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
      className={`mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border text-left transition ${
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
          <div className="flex h-40 items-center justify-center text-xs text-mute">
            geen beeld
          </div>
        )}
        {selecting && (
          <span
            className={`absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
              checked
                ? "border-accent bg-accent text-ink"
                : "border-chalk/60 bg-ink/60 text-transparent"
            }`}
          >
            ✓
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        <p className="text-sm leading-snug">{item.title || "Zonder titel"}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] text-accent">
            {item.category}
          </span>
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[11px] text-mute">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function Detail({
  item,
  similar,
  onOpen,
  onClose,
}: {
  item: Item;
  similar: Item[];
  onOpen: (item: Item) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface"
        onClick={(event) => event.stopPropagation()}
      >
        {item.hasImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={`/api/media/${item.id}`} alt={item.title} className="w-full" />
        )}

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h2 className="text-xl font-medium">{item.title || "Zonder titel"}</h2>
              <p className="mt-1 text-sm text-accent">{item.category}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-mute transition hover:text-chalk"
            >
              sluiten
            </button>
          </div>

          {item.description && (
            <p className="text-sm leading-relaxed text-chalk/85">{item.description}</p>
          )}
          {item.style && <p className="text-sm text-mute">{item.style}</p>}
          {item.notes && (
            <p className="border-l border-line pl-3 text-sm text-mute">{item.notes}</p>
          )}

          {item.colors.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {item.colors.map((color) => (
                <div key={color} className="flex items-center gap-2">
                  <span
                    className="h-5 w-5 rounded border border-line"
                    style={{ background: color }}
                  />
                  <span className="text-[11px] text-mute">{color}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line px-2.5 py-1 text-[11px] text-mute"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex gap-4 border-t border-line pt-4 text-xs">
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-mute transition hover:text-accent"
              >
                Bron openen
              </a>
            )}
            <a
              href={item.notionUrl}
              target="_blank"
              rel="noreferrer"
              className="text-mute transition hover:text-accent"
            >
              In Notion openen
            </a>
          </div>

          {similar.length > 0 && (
            <div className="space-y-3 border-t border-line pt-5">
              <p className="text-xs text-mute">Meer zoals dit</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {similar.map((other) => (
                  <button
                    key={other.id}
                    onClick={() => onOpen(other)}
                    title={other.title}
                    className="overflow-hidden rounded-lg border border-line transition hover:border-accent"
                  >
                    {other.hasImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/media/${other.id}`}
                        alt={other.title}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-[4/3] w-full bg-raised" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ total }: { total: number }) {
  return (
    <div className="py-24 text-center">
      <p className="text-sm text-mute">
        {total === 0
          ? "Nog niks in de vault. Voeg hierboven je eerste foto of link toe."
          : "Niks gevonden met deze filters."}
      </p>
    </div>
  );
}
