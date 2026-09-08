import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "./SiteShell";
import { Reveal } from "./Reveal";
import { RemoteImage } from "./RemoteImage";
import { BreadcrumbJsonLd } from "./BreadcrumbJsonLd";
import { CATEGORY_COPY, CATEGORY_SLUGS } from "@/content/categories";
import { getImagesData } from "@/lib/images-store";
import { getDictionary, localePath } from "@/i18n";
import { categoryPath, workPath } from "@/i18n/routes";
import type { Locale } from "@/i18n";
import type { ImageWithSlug, ImagesData } from "@/lib/images-types";

/**
 * One indexable page per subject, in both languages.
 *
 * WHY a server component rather than a client one like WorkPage: the whole
 * point of these pages is what a crawler receives, so the images, the prose
 * and — above all — the 404 for a subject with nothing in it have to be
 * decided on the server. A client-side "no pieces" branch would still answer
 * 200 and get indexed as thin content.
 *
 * WHY the tiles are links and not lightbox buttons: /work already owns the
 * lightbox, and every piece there is reachable only through ?tattoo=<slug>.
 * Rendering each tile as a real <a> to that URL is the one place in the site
 * where an individual tattoo gets a crawlable href, and it lands the reader in
 * exactly the view the archive would have opened. Duplicating the lightbox
 * here would mean two galleries to keep in step and zero extra links.
 */

/**
 * The breadcrumb's first rung. Not taken from the dictionary because `nav` has
 * no "home" entry — the site's own nav links home through the logo, not a word
 * — and inventing a Dictionary key for two strings used in one trail would
 * make every locale file carry it. The other two rungs DO come from live
 * sources (dict.nav.work, and the category's label from categories.json), so
 * the trail Google renders always reads the way the page itself reads.
 */
const CRUMB_HOME: Record<Locale, string> = {
  es: "Inicio",
  en: "Home",
};

/**
 * Appended to the hand-written title, which is sized to sit under ~60
 * characters on its own. "Bocha Tattoo" rather than the full legal name
 * because it is the brand people type, and it matches the domain.
 */
const TITLE_SUFFIX = " · Bocha Tattoo";

/** Visible pieces of one category, in the same order the archive shows them. */
function piecesOf(data: ImagesData, slug: string): ImageWithSlug[] {
  return Object.entries(data.manifest.images)
    .filter(([, entry]) => entry.category === slug && !entry.hidden)
    .map(([imageSlug, entry]) => ({ slug: imageSlug, ...entry }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** One pass over the manifest → visible piece count per category slug. */
function countVisibleByCategory(data: ImagesData): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of Object.values(data.manifest.images)) {
    if (entry.hidden || !entry.category) continue;
    counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }
  return counts;
}

function labelOf(data: ImagesData, slug: string, locale: Locale): string {
  const entry = data.categoriesData.categories.find((c) => c.slug === slug);
  return entry?.labels?.[locale] ?? entry?.labels?.es ?? slug.replace(/-/g, " ");
}

/**
 * Title, description and the full hreflang set for one category page.
 * Both route files call this so the canonical and the two alternates are
 * written once — a mismatched pair is the classic way to have Google index
 * the wrong language of a page.
 */
export function categoryMetadata(slug: string, locale: Locale): Metadata {
  const copy = CATEGORY_COPY[slug]?.[locale];
  // No copy means no page: the route will 404, so leave the tags empty rather
  // than invent a title for a URL that does not resolve.
  if (!copy) return {};

  const es = categoryPath("es", slug);
  const en = categoryPath("en", slug);

  return {
    title: `${copy.title}${TITLE_SUFFIX}`,
    description: copy.description,
    alternates: {
      canonical: locale === "es" ? es : en,
      languages: { es, en, "x-default": es },
    },
    openGraph: {
      title: `${copy.title}${TITLE_SUFFIX}`,
      description: copy.description,
      locale: locale === "es" ? "es_ES" : "en_US",
      type: "website",
    },
  };
}

export async function CategoryPage({
  slug,
  locale,
}: {
  slug: string;
  locale: Locale;
}) {
  const copy = CATEGORY_COPY[slug]?.[locale];
  // CATEGORY_SLUGS is the allow-list: a subject with no hand-written copy is
  // deliberately left out, because the alternative is a templated page whose
  // only distinguishing feature is the category name — a doorway page.
  if (!copy || !CATEGORY_SLUGS.includes(slug)) notFound();

  const data = await getImagesData();
  const categoryEntry = data.categoriesData.categories.find(
    (c) => c.slug === slug,
  );
  // Hiding a category removes it from the archive; its page has to go with it,
  // otherwise the site keeps serving work the artist pulled from view.
  if (categoryEntry?.hidden) notFound();

  const pieces = piecesOf(data, slug);
  // An empty category page is exactly the thin content this work exists to
  // avoid, and it is a live risk: categories.json outlives the images in it.
  if (pieces.length === 0) notFound();

  const dict = getDictionary(locale);
  const label = labelOf(data, slug, locale);
  const archiveHref = workPath(locale);

  // Sibling subjects, in the order the copy file sets, skipping any that would
  // 404 for the same reasons this page can. Linking category to category is
  // what stops each of these from being a leaf that only the sitemap knows.
  const visibleCounts = countVisibleByCategory(data);
  const hiddenCategories = new Set(
    data.categoriesData.categories.filter((c) => c.hidden).map((c) => c.slug),
  );
  const siblings = CATEGORY_SLUGS.filter(
    (other) =>
      other !== slug &&
      !hiddenCategories.has(other) &&
      (visibleCounts.get(other) ?? 0) > 0,
  ).map((other) => ({
    slug: other,
    label: labelOf(data, other, locale),
  }));

  return (
    <SiteShell dict={dict} locale={locale}>
      {/*
        Emitted after the 404 guards above, never before: a BreadcrumbList is a
        claim that this URL is a real rung of the site, and a page that is about
        to answer 404 must not make it. Placed here it can only ship on a page
        that actually rendered.
      */}
      <BreadcrumbJsonLd
        items={[
          { name: CRUMB_HOME[locale], url: localePath(locale) },
          { name: dict.nav.work, url: archiveHref },
          { name: label, url: categoryPath(locale, slug) },
        ]}
      />

      <section className="px-6 md:px-10 pt-32 md:pt-40 pb-16 md:pb-24">
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-end">
          <div className="md:col-span-4 flex flex-col gap-6">
            <Link
              href={archiveHref}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg transition-colors w-fit"
            >
              <span aria-hidden>←</span>
              <span>{dict.nav.work}</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {label} · {pieces.length}
            </span>
          </div>
          <div className="md:col-span-8">
            <Reveal>
              <h1 className="font-serif italic text-[13vw] md:text-[7vw] leading-[0.9] tracking-tight">
                {copy.heading}
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-8 max-w-2xl text-fg/80 text-base md:text-xl leading-relaxed">
                {copy.intro}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <div className="px-6 md:px-10 pb-20 md:pb-28 border-t border-line pt-16 md:pt-20">
        <div className="work-grid columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-4 [column-fill:_balance]">
          {pieces.map((piece, i) => {
            // "Animales 03" — the same label the archive uses. The original
            // filename is never exposed.
            const altLabel = `${label} ${String(i + 1).padStart(2, "0")}`;
            const isFirstRow = i < 4;
            return (
              <Link
                key={piece.slug}
                href={`${archiveHref}?tattoo=${piece.slug}`}
                aria-label={`${dict.work.open}: ${altLabel}`}
                data-cursor
                className="tile relative block w-full mb-3 md:mb-4 break-inside-avoid bg-line overflow-hidden"
                style={{ aspectRatio: `${piece.width} / ${piece.height}` }}
              >
                <RemoteImage
                  slug={piece.slug}
                  alt={altLabel}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                  className="object-cover tile-img"
                  priority={isFirstRow}
                  fetchPriority={isFirstRow ? "high" : "low"}
                />
              </Link>
            );
          })}
        </div>
      </div>

      <section className="px-6 md:px-10 py-16 md:py-24 border-t border-line">
        <Link
          href={archiveHref}
          className="text-xs uppercase tracking-[0.2em] font-mono border-b border-current pb-1 hover:opacity-60 transition-opacity"
        >
          {dict.work.viewAll}
        </Link>

        {siblings.length > 0 && (
          <nav aria-label={dict.nav.work} className="mt-12 md:mt-16">
            <ul className="flex flex-wrap gap-x-6 gap-y-3 text-xs uppercase tracking-[0.2em] font-mono text-muted">
              {siblings.map((sibling) => (
                <li key={sibling.slug}>
                  <Link
                    href={categoryPath(locale, sibling.slug)}
                    className="hover:text-fg transition-colors"
                  >
                    {sibling.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </section>
    </SiteShell>
  );
}
