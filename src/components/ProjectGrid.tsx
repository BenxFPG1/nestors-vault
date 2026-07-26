"use client";

import type { Item } from "@/lib/store";

/** Sober raster: op een projectpagina gaat het om de referenties zelf. */
export default function ProjectGrid({ items }: { items: Item[] }) {
  return (
    <div className="columns-2 gap-3 sm:gap-4 lg:columns-3">
      {items.map((item) => (
        <a
          key={item.id}
          href={`/?item=${item.id}`}
          className="mb-3 block break-inside-avoid overflow-hidden rounded-xl border border-line bg-surface transition hover:border-mute sm:mb-4"
        >
          {item.hasImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/media/${item.id}`}
              alt={item.title}
              loading="lazy"
              className="w-full"
            />
          )}
          <div className="space-y-1.5 p-3">
            <p className="text-sm leading-snug">{item.title || "Zonder titel"}</p>
            {item.annotations.length > 0 && (
              <ul className="space-y-1">
                {item.annotations.slice(0, 3).map((note) => (
                  <li key={note.id} className="text-[11px] leading-relaxed text-mute">
                    · {note.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
