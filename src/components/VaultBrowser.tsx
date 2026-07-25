"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Item } from "@/lib/store";
import AddBar from "./AddBar";

type Props = {
  items: Item[];
  tags: { tag: string; count: number }[];
  categories: string[];
  counts: { total: number; tagged: number; untagged: number };
};

export default function VaultBrowser({ items, tags, categories, counts }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("alles");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [open, setOpen] = useState<Item | null>(null);
  const [tagging, setTagging] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "alles" && item.category !== category) return false;
      if (!activeTags.every((tag) => item.tags.includes(tag))) return false;
      if (!needle) return true;
      return [item.title, item.description, item.style, item.notes, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, search, category, activeTags]);

  const toggleTag = (tag: string) =>
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );

  async function tagRest() {
    setTagging(true);
    setNote(null);
    try {
      const response = await fetch("/api/tag", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Taggen mislukt");
      setNote(
        result.tagged === 0 && result.remaining === 0
          ? "Alles is al getagd."
          : `${result.tagged} getagd${result.remaining ? `, nog ${result.remaining} te gaan` : ""}`,
      );
      router.refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Taggen mislukt");
    } finally {
      setTagging(false);
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
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Zoek op stijl, merk, kleur"
              className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none transition focus:border-accent sm:w-64 sm:flex-none"
            />
            {counts.untagged > 0 && (
              <button
                onClick={tagRest}
                disabled={tagging}
                className="shrink-0 rounded-full border border-line px-4 py-2 text-sm transition hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {tagging ? "Bezig…" : "Tag rest"}
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto flex max-w-[1500px] flex-wrap gap-2 overflow-x-auto px-4 pb-4 sm:px-6">
          <Pill active={category === "alles"} onClick={() => setCategory("alles")}>
            Alles
          </Pill>
          {categories.map((name) => (
            <Pill key={name} active={category === name} onClick={() => setCategory(name)}>
              {name}
            </Pill>
          ))}

          {tags.length > 0 && <span className="mx-1 w-px bg-line" aria-hidden />}

          {tags.map(({ tag, count }) => (
            <Pill key={tag} active={activeTags.includes(tag)} onClick={() => toggleTag(tag)}>
              {tag}
              <span className="ml-1.5 text-[10px] opacity-50">{count}</span>
            </Pill>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <AddBar onAdded={() => router.refresh()} />
        </div>

        {visible.length === 0 ? (
          <Empty total={counts.total} />
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {visible.map((item) => (
              <Card key={item.id} item={item} onOpen={() => setOpen(item)} />
            ))}
          </div>
        )}
      </main>

      {open && <Detail item={open} onClose={() => setOpen(null)} />}
    </div>
  );
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

function Card({ item, onOpen }: { item: Item; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border border-line bg-surface text-left transition hover:border-mute"
    >
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

function Detail({ item, onClose }: { item: Item; onClose: () => void }) {
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
