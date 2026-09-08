import type { MetadataRoute } from "next";
import { LOCALES, DEFAULT_LOCALE } from "@/i18n";
import type { Locale } from "@/i18n";
import {
  categoryPath,
  guestSpotCityPath,
  guestSpotsPath,
  workPath,
} from "@/i18n/routes";
import { CATEGORY_SLUGS } from "@/content/categories";
import { ENABLED_GUEST_SPOTS } from "@/config/guest-spots";
import { getImagesData } from "@/lib/images-store";

const BASE = "https://bochatattoo.com";

/**
 * One route family = the same page in every language. Paths are written out
 * per locale because the segments are translated ("tatuajes" / "tattoos"),
 * so they cannot be derived from a locale prefix.
 *
 * WHY paths carry no trailing slash (except the root, where it is the origin):
 * the app runs with Next's default `trailingSlash: false`, so "/en/" is a
 * redirect. A sitemap that lists the redirecting form disagrees with the
 * canonical the page itself declares, which is a cheap way to get the wrong
 * URL indexed.
 */
type Family = {
  paths: Record<Locale, string>;
  /** Priority for the default locale; other locales get 0.1 less. */
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  lastModified: Date;
};

function toEntries(family: Family): MetadataRoute.Sitemap {
  const languages: Record<string, string> = Object.fromEntries(
    LOCALES.map((l) => [l, `${BASE}${family.paths[l]}`]),
  );
  // x-default points at the Spanish page: it is the default locale and the one
  // served from the bare domain. Matches the alternates every page declares.
  languages["x-default"] = `${BASE}${family.paths[DEFAULT_LOCALE]}`;

  return LOCALES.map((l) => ({
    url: `${BASE}${family.paths[l]}`,
    lastModified: family.lastModified,
    changeFrequency: family.changeFrequency,
    priority:
      l === DEFAULT_LOCALE
        ? family.priority
        : Math.round((family.priority - 0.1) * 100) / 100,
    alternates: { languages },
  }));
}

/** Newest createdAt among a set of manifest entries, or `fallback`. */
function newest(timestamps: (string | undefined)[], fallback: Date): Date {
  let best = 0;
  for (const iso of timestamps) {
    if (!iso) continue;
    const t = Date.parse(iso);
    if (!Number.isNaN(t) && t > best) best = t;
  }
  return best > 0 ? new Date(best) : fallback;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { manifest, categoriesData } = await getImagesData();

  const hiddenCategories = new Set(
    categoriesData.categories.filter((c) => c.hidden).map((c) => c.slug),
  );

  // Visible pieces grouped by category, so both the "does this page exist"
  // test and its lastModified come from one pass over the manifest.
  const byCategory = new Map<string, (string | undefined)[]>();
  for (const entry of Object.values(manifest.images)) {
    if (entry.hidden || !entry.category) continue;
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry.createdAt);
    byCategory.set(entry.category, list);
  }

  const archiveModified = newest(
    Object.values(manifest.images)
      .filter((e) => !e.hidden)
      .map((e) => e.createdAt),
    now,
  );

  const families: Family[] = [
    {
      paths: { es: "/", en: "/en" },
      priority: 1,
      changeFrequency: "monthly",
      lastModified: now,
    },
    {
      paths: { es: workPath("es"), en: workPath("en") },
      priority: 0.8,
      changeFrequency: "weekly",
      lastModified: archiveModified,
    },
  ];

  // Category pages. The gate mirrors CategoryPage.tsx exactly — it 404s on a
  // slug without copy, on a hidden category and on a category with no visible
  // work — because a sitemap entry that answers 404 is worse than no entry at
  // all: it spends crawl budget and tells Google the file is unreliable.
  for (const slug of CATEGORY_SLUGS) {
    if (hiddenCategories.has(slug)) continue;
    const created = byCategory.get(slug);
    if (!created || created.length === 0) continue;
    families.push({
      paths: { es: categoryPath("es", slug), en: categoryPath("en", slug) },
      priority: 0.7,
      changeFrequency: "weekly",
      lastModified: newest(created, now),
    });
  }

  // Guest spots. Read from ENABLED_GUEST_SPOTS, never from GUEST_SPOTS: the
  // `enabled` flag is what retires a city from the pages, and the sitemap has
  // to retire it in the same move or it keeps advertising a page that is gone.
  if (ENABLED_GUEST_SPOTS.length > 0) {
    families.push({
      paths: { es: guestSpotsPath("es"), en: guestSpotsPath("en") },
      priority: 0.6,
      changeFrequency: "monthly",
      lastModified: now,
    });
    for (const spot of ENABLED_GUEST_SPOTS) {
      families.push({
        paths: {
          es: guestSpotCityPath("es", spot.slug),
          en: guestSpotCityPath("en", spot.slug),
        },
        priority: 0.5,
        changeFrequency: "monthly",
        lastModified: now,
      });
    }
  }

  return families.flatMap(toEntries);
}
