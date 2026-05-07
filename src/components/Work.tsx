"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Placeholder } from "./Placeholder";
import { RemoteImage } from "./RemoteImage";
import { Reveal } from "./Reveal";
import { Lightbox } from "./Lightbox";
import {
  useImagesMap,
  useCategories,
  useFeaturedSlugs,
} from "./ImagesProvider";
import { localePath } from "@/i18n";
import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n";

type Props = { dict: Dictionary["work"]; locale: Locale };

export function Work({ dict, locale }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { images, hiddenSet } = useImagesMap();
  const categories = useCategories();
  const featuredSlugs = useFeaturedSlugs();

  // 1) hand-picked slugs first, 2) top-up with one-per-category until
  // featuredLimit is reached. Hidden categories are skipped.
  const visibleCategoryOrder = [...categories]
    .filter((c) => !c.hidden)
    .sort((a, b) => a.order - b.order)
    .map((c) => c.slug);

  const labelOf = (slug: string): string => {
    const c = categories.find((c) => c.slug === slug);
    return c?.labels?.[locale] ?? c?.labels?.es ?? slug.replace(/-/g, " ");
  };

  const seen = new Set<string>();
  const handPicked = featuredSlugs
    .map((slug) => {
      if (hiddenSet.has(slug)) return null;
      const entry = images[slug];
      return entry ? { slug, ...entry } : null;
    })
    .filter((img): img is NonNullable<typeof img> => Boolean(img));
  for (const img of handPicked) seen.add(img.slug);

  const fillers = visibleCategoryOrder
    .map((c) => {
      return Object.entries(images)
        .filter(
          ([slug, e]) =>
            e.category === c && !seen.has(slug) && !hiddenSet.has(slug),
        )
        .map(([slug, e]) => ({ slug, ...e }))
        .sort((a, b) => a.slug.localeCompare(b.slug))[0];
    })
    .filter((img): img is NonNullable<typeof img> => Boolean(img));

  const featured = [...handPicked, ...fillers].slice(0, dict.featuredLimit);
  const home = localePath(locale);
  const workHref = `${home === "/" ? "" : home}/work`;

  // Build a per-image label "Category NN" — used for both the <img> alt and
  // the lightbox aria. The original manifest title/filename is never exposed.
  const catSeen: Record<string, number> = {};
  const tiles = featured.map((img) => {
    const cat = img.category ?? "";
    catSeen[cat] = (catSeen[cat] ?? 0) + 1;
    const n = String(catSeen[cat]).padStart(2, "0");
    const catLabel = cat ? labelOf(cat) : "";
    const altLabel = catLabel ? `${catLabel} ${n}` : n;
    return { ...img, altLabel, catLabel };
  });

  const pieces = tiles.map((t) => ({
    slug: t.slug,
    alt: t.altLabel,
    category: t.catLabel || undefined,
  }));

  // Open directly to ?tattoo=slug on mount
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("tattoo");
    if (slug) {
      const idx = pieces.findIndex((p) => p.slug === slug);
      if (idx !== -1) setOpenIndex(idx);
    }
  // pieces identity is stable after first render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="work" className="px-6 md:px-10 py-24 md:py-32">
      <Reveal>
        <div className="flex items-baseline justify-between mb-12 md:mb-16">
          <h2 className="font-serif italic text-3xl md:text-5xl">{dict.title}</h2>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {dict.eyebrow}
          </span>
        </div>
      </Reveal>

      {featured.length > 0 ? (
        <div className="work-grid grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
          {tiles.map((img, i) => (
            <Reveal key={img.slug} delay={(i % 3) * 80}>
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                aria-label={`${dict.open}: ${img.altLabel}`}
                data-cursor
                className="relative w-full aspect-square bg-line overflow-hidden tile block text-left cursor-pointer"
              >
                <RemoteImage
                  slug={img.slug}
                  alt={img.altLabel}
                  fill
                  sizes="(min-width: 768px) 33vw, 50vw"
                  className="object-cover tile-img"
                  priority={i < 3}
                  fetchPriority={i < 3 ? "high" : "low"}
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
        endCard={{
          title: dict.lightbox.endTitle,
          copy: dict.lightbox.endCopy,
          startOverLabel: dict.lightbox.startOver,
          continueLabel: dict.lightbox.continueLabel,
          continueHref: workHref,
        }}
      />
    </section>
  );
}
