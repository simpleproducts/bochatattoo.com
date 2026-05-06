"use client";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { SiteShell } from "./SiteShell";
import { Reveal } from "./Reveal";
import { RemoteImage } from "./RemoteImage";
import { Lightbox } from "./Lightbox";
import {
  listImages,
  listImagesByCategory,
  type ImageWithSlug,
} from "@/lib/images";
import { localePath } from "@/i18n";
import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n";

type Section = {
  slug: string;
  label: string;
  images: ImageWithSlug[];
};

export function WorkPage({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const work = dict.work;
  const home = localePath(locale);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const sections = useMemo<Section[]>(() => {
    const skip = new Set(work.skipCategories);
    const ordered = work.categoryOrder.filter((c) => !skip.has(c));
    const seen = new Set(ordered);
    const allCategories = Array.from(
      new Set(
        listImages()
          .map((i) => i.category)
          .filter((c): c is string => Boolean(c) && !skip.has(c!)),
      ),
    );
    // Append any categories present in the manifest but missing from explicit order
    const tail = allCategories.filter((c) => !seen.has(c)).sort();
    return [...ordered, ...tail]
      .map((slug) => ({
        slug,
        label: work.categoryLabels[slug] ?? slug.replace(/-/g, " "),
        images: listImagesByCategory(slug),
      }))
      .filter((s) => s.images.length > 0);
  }, [work]);

  const flat = useMemo(
    () => sections.flatMap((s) => s.images),
    [sections],
  );
  const totalCount = flat.length;
  // Build a "Category NN" label for each image — used as alt text and
  // as the lightbox aria description. The original filename never appears.
  const lightboxPieces = sections.flatMap((section) => {
    const catLabel = work.categoryLabels[section.slug] ?? section.label;
    return section.images.map((img, i) => ({
      slug: img.slug,
      alt: `${catLabel} ${String(i + 1).padStart(2, "0")}`,
      category: catLabel,
    }));
  });

  // Map slug → global index for lightbox open
  const indexBySlug = useMemo(() => {
    const m = new Map<string, number>();
    flat.forEach((img, i) => m.set(img.slug, i));
    return m;
  }, [flat]);

  // Open directly to ?foto=slug on mount
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("foto");
    if (slug) {
      const idx = indexBySlug.get(slug);
      if (idx !== undefined) setOpenIndex(idx);
    }
    setReady(true);
  // indexBySlug is stable after mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SiteShell dict={dict} locale={locale}>
      {/* Hero */}
      <section className="px-6 md:px-10 pt-32 md:pt-40 pb-16 md:pb-24">
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-end">
          <div className="md:col-span-4 flex flex-col gap-6">
            <Link
              href={home}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg transition-colors w-fit"
            >
              <span aria-hidden>←</span>
              <span>{work.back}</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {work.eyebrow} · {totalCount}
            </span>
          </div>
          <div className="md:col-span-8">
            <Reveal>
              <h1 className="font-serif italic text-[18vw] md:text-[12vw] leading-[0.85] tracking-tight">
                {work.pageTitle}
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-8 max-w-xl text-fg/70 text-lg md:text-xl leading-snug">
                {work.intro}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Category index — horizontal scroll on mobile, sticky strip on desktop */}
      {sections.length > 0 && (
        <nav
          aria-label="Categories"
          className="border-y border-line px-6 md:px-10 py-4 sticky top-[60px] md:top-[72px] z-30 bg-bg/80 backdrop-blur-md overflow-x-auto"
        >
          <ul className="flex items-center gap-6 text-xs uppercase tracking-[0.2em] font-mono whitespace-nowrap">
            {sections.map((s) => (
              <li key={s.slug}>
                <a
                  href={`#${s.slug}`}
                  className="text-muted hover:text-fg transition-colors"
                >
                  {s.label}{" "}
                  <span className="opacity-50">{s.images.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="px-6 md:px-10 py-32 text-center">
          <p className="font-serif italic text-2xl text-muted">
            {work.emptyState}
          </p>
        </div>
      ) : (
        <div className="px-6 md:px-10">
          {sections.map((section, sIdx) => (
            <section
              key={section.slug}
              id={section.slug}
              className="py-20 md:py-28 border-t border-line first:border-t-0"
            >
              <Reveal>
                <header className="grid grid-cols-3 items-baseline mb-10 md:mb-14 gap-4">
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                    {String(sIdx + 1).padStart(2, "0")}
                  </span>
                  <h2 className="font-serif italic text-3xl md:text-5xl text-center">
                    {section.label}
                  </h2>
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted text-right">
                    {section.images.length}
                  </span>
                </header>
              </Reveal>

              <div className="work-grid columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-4 [column-fill:_balance]">
                {section.images.map((img, iIdx) => {
                  const globalIdx = indexBySlug.get(img.slug) ?? 0;
                  const isFirstRow = sIdx === 0 && iIdx < 4;
                  const altLabel = `${section.label} ${String(iIdx + 1).padStart(2, "0")}`;
                  return (
                    <button
                      key={img.slug}
                      type="button"
                      onClick={() => setOpenIndex(globalIdx)}
                      aria-label={`${work.open}: ${altLabel}`}
                      data-cursor
                      className="tile relative block w-full mb-3 md:mb-4 break-inside-avoid bg-line overflow-hidden text-left"
                      style={{ aspectRatio: `${img.width} / ${img.height}` }}
                    >
                      <RemoteImage
                        slug={img.slug}
                        alt={altLabel}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                        className="object-cover tile-img"
                        priority={isFirstRow}
                        fetchPriority={isFirstRow ? "high" : "low"}
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Lightbox
        pieces={lightboxPieces}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onIndexChange={setOpenIndex}
        labels={work.lightbox}
      />
    </SiteShell>
  );
}
