"use client";

import { useEffect, useRef, useState } from "react";
import type { Item } from "@/lib/store";
import type { Annotation } from "@/lib/notion";

type Box = { x: number; y: number; w: number; h: number };

export default function ItemDetail({
  item,
  similar,
  projects,
  onOpen,
  onClose,
  onChanged,
}: {
  item: Item;
  similar: Item[];
  projects: string[];
  onOpen: (item: Item) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState<Annotation[]>(item.annotations);
  const [linked, setLinked] = useState<string[]>(item.projects);
  const [comment, setComment] = useState("");
  const [marking, setMarking] = useState(false);
  const [draft, setDraft] = useState<Box | null>(null);
  const [drawing, setDrawing] = useState<Box | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const surface = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  // Openstaand venster: achtergrond niet mee laten scrollen op mobiel.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    setNotes(item.annotations);
    setLinked(item.projects);
    setMarking(false);
    setDraft(null);
    setConfirmDelete(false);
  }, [item]);

  async function save(next: Annotation[]) {
    setNotes(next);
    setBusy(true);
    try {
      await fetch(`/api/item/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations: next }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function saveProjects(next: string[]) {
    setLinked(next);
    setBusy(true);
    try {
      await fetch(`/api/item/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: next }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/item/${item.id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function addComment(text: string, box?: Box) {
    const clean = text.trim();
    if (!clean) return;
    void save([
      ...notes,
      {
        id: Math.random().toString(36).slice(2, 10),
        text: clean.slice(0, 400),
        at: new Date().toISOString(),
        box,
      },
    ]);
  }

  /* ── Omcirkelen op het beeld ────────────────────────────────────────── */

  function pointFrom(event: React.PointerEvent) {
    const rect = surface.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function onPointerDown(event: React.PointerEvent) {
    if (!marking || draft) return;
    event.preventDefault();
    surface.current?.setPointerCapture(event.pointerId);
    start.current = pointFrom(event);
    setDrawing({ ...start.current, w: 0, h: 0 });
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!start.current) return;
    const now = pointFrom(event);
    setDrawing({
      x: Math.min(start.current.x, now.x),
      y: Math.min(start.current.y, now.y),
      w: Math.abs(now.x - start.current.x),
      h: Math.abs(now.y - start.current.y),
    });
  }

  function onPointerUp() {
    if (!drawing) return;
    start.current = null;

    // Een tik zonder slepen wordt een klein kadertje rond dat punt.
    const box =
      drawing.w < 2 || drawing.h < 2
        ? {
            x: Math.max(0, drawing.x - 6),
            y: Math.max(0, drawing.y - 6),
            w: 12,
            h: 12,
          }
        : drawing;

    setDrawing(null);
    setDraft(box);
  }

  const pinned = notes.filter((note) => note.box);
  const plain = notes.filter((note) => !note.box);

  return (
    <div
      className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-ink/85 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="mx-auto min-h-full w-full max-w-4xl border-line bg-surface sm:my-4 sm:min-h-0 sm:rounded-2xl sm:border"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Balk bovenaan blijft staan, ook als je op je telefoon scrolt. */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
          <button
            onClick={onClose}
            className="rounded-full border border-line px-3 py-2 text-xs text-mute transition hover:text-chalk"
          >
            sluiten
          </button>

          {item.hasImage && (
            <button
              onClick={() => {
                setMarking((value) => !value);
                setDraft(null);
              }}
              className={`rounded-full border px-3 py-2 text-xs transition ${
                marking
                  ? "border-accent bg-accent text-ink"
                  : "border-line text-mute hover:text-chalk"
              }`}
            >
              {marking ? "klaar met markeren" : "markeer op beeld"}
            </button>
          )}

          <span className="ml-auto text-[11px] text-mute">{busy ? "opslaan…" : ""}</span>

          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <button
                onClick={remove}
                className="rounded-full bg-red-500/90 px-3 py-2 text-xs text-ink transition hover:bg-red-500"
              >
                echt verwijderen
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-mute transition hover:text-chalk"
              >
                nee
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded-full border border-line px-3 py-2 text-xs text-mute transition hover:border-red-500/60 hover:text-red-400"
            >
              verwijder
            </button>
          )}
        </div>

        {item.hasImage && (
          <div
            ref={surface}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={`relative select-none ${marking ? "cursor-crosshair touch-none" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/media/${item.id}`}
              alt={item.title}
              draggable={false}
              className="w-full"
            />

            {pinned.map((note, index) => (
              <span
                key={note.id}
                onMouseEnter={() => setHover(note.id)}
                onMouseLeave={() => setHover(null)}
                className={`pointer-events-auto absolute rounded-lg border-2 transition ${
                  hover === note.id ? "border-accent bg-accent/15" : "border-accent/70"
                }`}
                style={{
                  left: `${note.box!.x}%`,
                  top: `${note.box!.y}%`,
                  width: `${note.box!.w}%`,
                  height: `${note.box!.h}%`,
                }}
              >
                <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-ink">
                  {index + 1}
                </span>
              </span>
            ))}

            {(drawing || draft) && (
              <span
                className="pointer-events-none absolute rounded-lg border-2 border-dashed border-chalk bg-chalk/10"
                style={{
                  left: `${(drawing ?? draft)!.x}%`,
                  top: `${(drawing ?? draft)!.y}%`,
                  width: `${(drawing ?? draft)!.w}%`,
                  height: `${(drawing ?? draft)!.h}%`,
                }}
              />
            )}

            {marking && !draft && !drawing && (
              <span className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-ink/80 px-3 py-1.5 text-xs text-chalk">
                Sleep een kader, of tik ergens
              </span>
            )}
          </div>
        )}

        {draft && (
          <div className="border-b border-line bg-raised px-4 py-3">
            <p className="mb-2 text-xs text-mute">Wat valt je hier op?</p>
            <div className="flex gap-2">
              <input
                autoFocus
                placeholder="bv. deze knop springt er goed uit"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addComment((event.target as HTMLInputElement).value, draft);
                    setDraft(null);
                  }
                  if (event.key === "Escape") setDraft(null);
                }}
                className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-accent"
              />
              <button
                onClick={() => setDraft(null)}
                className="shrink-0 rounded-xl border border-line px-4 text-xs text-mute"
              >
                weg
              </button>
            </div>
          </div>
        )}

        <div className="space-y-6 p-4 sm:p-6">
          <div>
            <h2 className="text-xl font-medium">{item.title || "Zonder titel"}</h2>
            <p className="mt-1 text-sm text-accent">{item.category}</p>
          </div>

          {item.description && (
            <p className="text-sm leading-relaxed text-chalk/85">{item.description}</p>
          )}
          {item.style && <p className="text-sm text-mute">{item.style}</p>}

          {/* Projecten */}
          <div className="space-y-2">
            <p className="text-xs text-mute">Projecten</p>
            <div className="flex flex-wrap gap-2">
              {projects.length === 0 && (
                <span className="text-xs text-mute">
                  Nog geen projecten. Maak er een aan in de balk bovenaan.
                </span>
              )}
              {projects.map((project) => {
                const on = linked.includes(project);
                return (
                  <button
                    key={project}
                    onClick={() =>
                      saveProjects(
                        on
                          ? linked.filter((entry) => entry !== project)
                          : [...linked, project],
                      )
                    }
                    className={`rounded-full border px-3 py-2 text-xs transition ${
                      on
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-line text-mute hover:text-chalk"
                    }`}
                  >
                    {project}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opmerkingen */}
          <div className="space-y-3">
            <p className="text-xs text-mute">Opmerkingen</p>

            {notes.length === 0 && (
              <p className="text-xs text-mute">
                Nog niks. Markeer iets op het beeld, of schrijf hieronder.
              </p>
            )}

            <ul className="space-y-2">
              {pinned.map((note, index) => (
                <Note
                  key={note.id}
                  index={index + 1}
                  note={note}
                  onHover={setHover}
                  onDelete={() => save(notes.filter((entry) => entry.id !== note.id))}
                />
              ))}
              {plain.map((note) => (
                <Note
                  key={note.id}
                  note={note}
                  onHover={setHover}
                  onDelete={() => save(notes.filter((entry) => entry.id !== note.id))}
                />
              ))}
            </ul>

            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addComment(comment);
                    setComment("");
                  }
                }}
                placeholder="Opmerking toevoegen"
                className="min-w-0 flex-1 rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-accent"
              />
              <button
                onClick={() => {
                  addComment(comment);
                  setComment("");
                }}
                disabled={!comment.trim()}
                className="shrink-0 rounded-xl border border-line px-4 text-xs transition hover:border-accent hover:text-accent disabled:opacity-40"
              >
                plaats
              </button>
            </div>
          </div>

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

function Note({
  note,
  index,
  onHover,
  onDelete,
}: {
  note: Annotation;
  index?: number;
  onHover: (id: string | null) => void;
  onDelete: () => void;
}) {
  return (
    <li
      onMouseEnter={() => onHover(note.id)}
      onMouseLeave={() => onHover(null)}
      className="flex items-start gap-3 rounded-xl border border-line bg-raised px-3 py-2.5"
    >
      {index ? (
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-ink">
          {index}
        </span>
      ) : (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-mute" />
      )}
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-chalk/90">{note.text}</p>
      <button
        onClick={onDelete}
        aria-label="Opmerking verwijderen"
        className="shrink-0 text-xs text-mute transition hover:text-red-400"
      >
        ×
      </button>
    </li>
  );
}
