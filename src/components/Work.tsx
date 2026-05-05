"use client";
import { useState } from "react";
import Link from "next/link";
import { Placeholder } from "./Placeholder";
import { RemoteImage } from "./RemoteImage";
import { Reveal } from "./Reveal";
import { Lightbox } from "./Lightbox";
import { listImagesByCategory } from "@/lib/images";
import { localePath } from "@/i18n";
import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n";

type Props = { dict: Dictionary["work"]; locale: Locale };

export function Work({ dict, locale }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // One image per category, in the dictionary's display order, until we fill
  // the grid. Avoids the home strip looking like a single-category sample.
  const skip = new Set(dict.skipCategories);
  const featured = dict.categoryOrder
    .filter((c) => !skip.has(c))
    .map((c) => listImagesByCategory(c)[0])
    .filter((img): img is NonNullable<typeof img> => Boolean(img))
    .slice(0, dict.featuredLimit);
  const workHref = locale === "en" ? "/work" : `/${locale}/work`;
  const home = localePath(locale);

  // Lightbox feeds on title from manifest alt or category label fallback
  const pieces = featured.map((img) => ({
    slug: img.slug,
    title: img.alt,
  }));

  return (
    <section id="work" className="px-6 md:px-10 py-24 md:py-32">
      <Reveal>
        <div className="flex items-baseline justify-between mb-12 md:mb-16">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {dict.eyebrow}
          </span>
          <h2 className="font-serif italic text-3xl md:text-5xl">{dict.title}</h2>
        </div>
      </Reveal>

      {featured.length > 0 ? (
        <div className="work-grid grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
          {featured.map((img, i) => (
            <Reveal key={img.slug} delay={(i % 3) * 80}>
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                aria-label={`${dict.open}: ${img.alt}`}
                data-cursor
                className="relative w-full aspect-square bg-line overflow-hidden tile block text-left"
              >
                <RemoteImage
                  slug={img.slug}
                  alt={img.alt}
                  fill
                  sizes="(min-width: 768px) 33vw, 50vw"
                  className="object-cover tile-img"
                />
                <div
                  aria-hidden
                  className="tile-overlay absolute inset-0 bg-bg/0 transition-colors duration-500 flex items-end p-4"
                >
                  <span className="opacity-0 -translate-y-2 transition-all duration-500 tile-label text-[10px] uppercase tracking-[0.2em] font-mono text-fg">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <Placeholder
              key={i}
              label="Loading"
              ratio="square"
              index={i + 1}
            />
          ))}
        </div>
      )}

      <div className="mt-12 flex items-center justify-between flex-wrap gap-4">
        <Link
          href={workHref}
          className="text-xs uppercase tracking-[0.2em] font-mono border-b border-current pb-1 hover:opacity-60 transition-opacity"
        >
          {dict.viewAll}
        </Link>
        <a
          href={`${home === "/" ? "" : home}/#contact`.replace("//", "/")}
          className="text-xs uppercase tracking-[0.2em] font-mono border-b border-current pb-1 hover:opacity-60 transition-opacity"
        >
          {dict.inquire}
        </a>
      </div>

      <Lightbox
        pieces={pieces}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onIndexChange={setOpenIndex}
        labels={dict.lightbox}
      />
    </section>
  );
}
