/**
 * Which pieces the home Work strip shows, in order.
 *
 * Shared by the strip itself (Work.tsx, client) and by HomePage (server),
 * which uses it to hand the strip ONLY those manifest entries instead of the
 * whole archive. The two must agree on the list, so the rule lives here once.
 *
 * Running this again on a manifest already narrowed to its own output returns
 * the same list: the hand-picked prefix survives intact, and every filler is
 * the only unseen piece left in its category.
 */
import type {
  CategoryEntry,
  ImageEntry,
  ImageWithSlug,
} from "./images-types";

export function selectFeatured(
  images: Record<string, ImageEntry>,
  hiddenSet: ReadonlySet<string>,
  categories: CategoryEntry[],
  featuredSlugs: string[],
  limit: number,
): ImageWithSlug[] {
  // 1) hand-picked slugs first, 2) top-up with one-per-category until
  // `limit` is reached. Hidden categories are skipped.
  const visibleCategoryOrder = [...categories]
    .filter((c) => !c.hidden)
    .sort((a, b) => a.order - b.order)
    .map((c) => c.slug);

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

  return [...handPicked, ...fillers].slice(0, limit);
}
