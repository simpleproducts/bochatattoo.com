import type { CategoryEntry } from "@/lib/images-types";

/**
 * Display name for a category in the admin UI. Prefer the Spanish label
 * (the artist's primary working language), fall back to English, fall back
 * to the slug rendered with spaces. The slug is also returned as a 2nd
 * value so callers that need both can show e.g. "Animales (animales)".
 */
export function categoryLabel(c: CategoryEntry): string {
  const es = c.labels?.es?.trim();
  const en = c.labels?.en?.trim();
  return es || en || c.slug.replace(/-/g, " ");
}
