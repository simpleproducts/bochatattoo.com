"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SiteShell } from "./SiteShell";
import { Reveal } from "./Reveal";
import { RemoteImage } from "./RemoteImage";
import { Lightbox } from "./Lightbox";
import {
  useAllImages,
  useCategories,
  useImagesMap,
} from "./ImagesProvider";
import type { ImageWithSlug } from "@/lib/images-types";
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
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const allImages = useAllImages();
  const categories = useCategories();
  const { hiddenSet } = useImagesMap();

  const sections = useMemo<Section[]>(() => {
    // Categories visible in the archive, ordered by `order`. Slugs not in
    // categories.json fall through to a "tail" sorted alphabetically.
    const visibleCats = categories.filter((c) => !c.hidden);
    // Tail = images whose category isn't registered AT ALL in categories.json.
    // Images whose category is registered but hidden must NOT leak through here.
    const declaredSlugs = new Set(categories.map((c) => c.slug));
    const tailSlugs = Array.from(
      new Set(
        allImages
          .map((i) => i.category)
          .filter(
            (c): c is string =>
              typeof c === "string" && !declaredSlugs.has(c),
          ),
      ),
    ).sort();

    const orderedSlugs = [
      ...[...visibleCats]
        .sort((a, b) => a.order - b.order)
        .map((c) => c.slug),
      ...tailSlugs,
    ];

    const labelOf = (slug: string): string => {
      const c = categories.find((c) => c.slug === slug);
      return (
        c?.labels?.[locale] ??
        c?.labels?.es ??
        slug.replace(/-/g, " ")
      );
    };

    return orderedSlugs
      .map((slug) => ({
        slug,
        label: labelOf(slug),
        images: allImages
          .filter((i) => i.category === slug && !hiddenSet.has(i.slug))
          .sort((a, b) => a.slug.localeCompare(b.slug)),
      }))
      .filter((s) => s.images.length > 0);
  }, [allImages, categories, hiddenSet, locale]);

  const flat = useMemo(
    () => sections.flatMap((s) => s.images),
    [sections],
  );
  const totalCount = flat.length;
  // Build a "Category NN" label for each image — used as alt text and
  // as the lightbox aria description. The original filename never appears.
  const lightboxPieces = sections.flatMap((section) =>
    section.images.map((img, i) => ({
      slug: img.slug,
      alt: `${section.label} ${String(i + 1).padStart(2, "0")}`,
      category: section.label,
    })),
  );

  // Map slug → global index for lightbox open
  const indexBySlug = useMemo(() => {
    const m = new Map<string, number>();
    flat.forEach((img, i) => m.set(img.slug, i));
    return m;
  }, [flat]);

  // Open directly to ?tattoo=slug on mount
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("tattoo");
    if (slug) {
      const idx = indexBySlug.get(slug);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (idx !== undefined) setOpenIndex(idx);
    }
  // indexBySlug is stable after mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll-spy: track which section is currently in view so the category
  // nav can highlight it. Trigger line sits just below the sticky nav strip.
  useEffect(() => {
    if (sections.length === 0) return;
    const elements = sections
      .map((s) => document.getElementById(s.slug))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const headerOffset = window.matchMedia("(min-width: 768px)").matches
      ? 128 // 72px top nav + ~56px sticky strip
      : 116; // 60px top nav + ~56px sticky strip

    const visible = new Set<string>();
    const pickActive = () => {
      // Prefer the deepest section whose top has crossed below the sticky
      // header (most recently scrolled into the active window).
      let best: { slug: string; top: number } | null = null;
      for (const el of elements) {
        if (!visible.has(el.id)) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= headerOffset && (!best || top > best.top)) {
          best = { slug: el.id, top };
        }
      }
      if (best) return setActiveSlug(best.slug);
      // None has crossed yet — fall back to the first one still in view.
      const firstVisible = elements.find((el) => visible.has(el.id));
      if (firstVisible) setActiveSlug(firstVisible.id);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        pickActive();
      },
      {
        rootMargin: `-${headerOffset}px 0px -55% 0px`,
        threshold: 0,
      },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active link in view inside the horizontal-scrolling nav strip.
  useEffect(() => {
    if (!activeSlug || !navRef.current) return;
    const link = navRef.current.querySelector<HTMLAnchorElement>(
      `a[data-slug="${activeSlug}"]`,
    );
    link?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeSlug]);

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
          ref={navRef}
          aria-label="Categories"
          className="border-y border-line px-6 md:px-10 py-4 sticky top-[60px] md:top-[72px] z-30 bg-bg/80 backdrop-blur-md overflow-x-auto"
        >
          <ul className="flex items-center gap-6 text-xs uppercase tracking-[0.2em] font-mono whitespace-nowrap">
            {sections.map((s) => {
              const isActive = activeSlug === s.slug;
              return (
                <li key={s.slug}>
                  <a
                    href={`#${s.slug}`}
                    data-slug={s.slug}
                    aria-current={isActive ? "true" : undefined}
                    className={`transition-colors ${
                      isActive ? "text-fg" : "text-muted hover:text-fg"
                    }`}
                  >
                    {s.label}{" "}
                    <span className="opacity-50">{s.images.length}</span>
                  </a>
                </li>
              );
            })}
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
