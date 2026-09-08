import { DEFAULT_LOCALE, LOCALES, isLocale } from "./config";
import type { Locale } from "./config";

/**
 * URL segments that are spelled differently in each language, and the helpers
 * that build and re-map paths containing them.
 *
 * WHY THIS FILE EXISTS. Most of the site's routes are the same word in both
 * languages — /work and /en/work, /guest-spots and /en/guest-spots — so for
 * years switching language meant nothing more than adding or removing an "/en"
 * prefix, which is all `localePath` and the language switcher ever did. The
 * category pages broke that assumption: they are /tatuajes/<slug> in Spanish
 * and /en/tattoos/<slug> in English, so the prefix is no longer the only
 * difference between the two URLs for one page.
 *
 * Anything that only adds the prefix now produces a URL that 404s
 * (/en/tatuajes/animales, /tattoos/animales), and it does so silently — the
 * link renders and looks right until somebody clicks it. So the mapping lives
 * here, once, and everything that needs it reads from this file.
 *
 * WHY IT IS PURE — no "server-only", no manifest, no dictionary. It has to be
 * importable from a "use client" module (the language switcher, the archive)
 * AND from server components and the sitemap. That is exactly what stopped the
 * segments being shared before: the only place that knew them was a
 * server-only module, so each client caller kept its own copy of the strings
 * and the copies could not be checked against each other.
 */

/** A route whose segment differs between languages. */
type RouteKey = "category";

/**
 * The segment per language. These MUST match the directory names under
 * src/app — src/app/(es)/tatuajes and src/app/(en)/en/tattoos — because those
 * folders are what actually define the URLs. Renaming a folder without
 * changing this map is the one way these can still drift.
 */
const TRANSLATED_SEGMENTS: Record<RouteKey, Record<Locale, string>> = {
  category: { es: "tatuajes", en: "tattoos" },
};

/**
 * Every language's spelling of a segment → the route it belongs to, so a path
 * can be recognised without knowing which language it came in as. Derived from
 * the map above rather than written out, so adding a language or renaming a
 * segment cannot leave a stale half behind.
 */
const SEGMENT_TO_KEY: Record<string, RouteKey> = {};
for (const key of Object.keys(TRANSLATED_SEGMENTS) as RouteKey[]) {
  for (const locale of LOCALES) {
    SEGMENT_TO_KEY[TRANSLATED_SEGMENTS[key][locale]] = key;
  }
}

/**
 * Joins a locale-less path onto its locale prefix. The default locale is
 * served from the bare domain, so it takes no prefix at all; an empty rest is
 * the home page of that language.
 */
function prefixed(locale: Locale, rest: string): string {
  const base = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  if (!rest) return base || "/";
  return `${base}/${rest}`;
}

/** "/tatuajes/animales" in Spanish, "/en/tattoos/animales" in English. */
export function categoryPath(locale: Locale, slug: string): string {
  return prefixed(locale, `${TRANSLATED_SEGMENTS.category[locale]}/${slug}`);
}

/** "/work" in Spanish, "/en/work" in English. Same word, still worth naming. */
export function workPath(locale: Locale): string {
  return prefixed(locale, "work");
}

/**
 * "/guest-spots" in Spanish, "/en/guest-spots" in English.
 *
 * The segment is the same word in both languages, so this needs no entry in
 * TRANSLATED_SEGMENTS. It lives here anyway because the Footer links the hub on
 * every page of the site, and Footer importing it from GuestSpotsPage would
 * close an import cycle (Footer ← SiteShell ← GuestSpotsPage).
 */
export function guestSpotsPath(locale: Locale): string {
  return prefixed(locale, "guest-spots");
}

/** "/guest-spots/berlin" and "/en/guest-spots/berlin" — the slug is shared. */
export function guestSpotCityPath(locale: Locale, slug: string): string {
  return prefixed(locale, `guest-spots/${slug}`);
}

/**
 * The same page, in another language: swaps the locale prefix AND translates
 * any segment that differs between languages.
 *
 * Used by the language switcher, which runs on every page of the site and only
 * knows the current pathname — it has no idea which route it is on. A path
 * whose segments are the same in both languages passes through with just the
 * prefix changed, which is why this can replace the old prefix-only logic
 * outright rather than sitting beside it as a special case.
 */
export function translatePath(pathname: string, target: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  // Drop the source language's prefix, if it had one, to get a bare path.
  if (parts[0] && isLocale(parts[0])) parts.shift();

  const key = parts.length > 0 ? SEGMENT_TO_KEY[parts[0]] : undefined;
  if (key) parts[0] = TRANSLATED_SEGMENTS[key][target];

  return prefixed(target, parts.join("/"));
}
