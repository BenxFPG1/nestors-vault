import type { Metadata } from "next";
import { readShareLink } from "@/lib/share";
import { getItem } from "@/lib/notion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Moodboard",
  robots: { index: false, follow: false },
};

export default async function Moodboard({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = await readShareLink(token);

  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-mute">
          Deze link is verlopen of klopt niet meer.
        </p>
      </div>
    );
  }

  const items = (await Promise.all(payload.ids.map((id) => getItem(id)))).filter(
    (item) => item !== null,
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-10">
        <h1 className="text-2xl font-medium tracking-tight">
          {payload.title || "Moodboard"}
        </h1>
        <p className="mt-2 text-xs text-mute">
          {items.length} referenties · samengesteld door Nestors Create
        </p>
      </header>

      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {items.map((item) => (
          <figure
            key={item.id}
            className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-line bg-surface"
          >
            {item.hasImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={`/api/deel/${token}/${item.id}`}
                alt={item.title}
                loading="lazy"
                className="w-full"
              />
            )}
            <figcaption className="space-y-1 p-3">
              <p className="text-sm leading-snug">{item.title || "Zonder titel"}</p>
              {item.style && <p className="text-xs text-mute">{item.style}</p>}
            </figcaption>
          </figure>
        ))}
      </div>

      {items.length === 0 && (
        <p className="py-20 text-center text-sm text-mute">
          De items uit dit moodboard bestaan niet meer.
        </p>
      )}
    </div>
  );
}
