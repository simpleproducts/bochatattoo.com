import { SITE_URL } from "@/lib/site";

/** One rung of the trail. `url` may be a site-relative path or an absolute URL. */
export type Crumb = {
  /** The label as it reads on the page, in that page's own language. */
  name: string;
  /** "/tatuajes/animales" or "https://bochatattoo.com/tatuajes/animales". */
  url: string;
};

/**
 * Makes a crumb's URL absolute, because BreadcrumbList `item` values are
 * resolved by the crawler with no page context and a bare "/tatuajes/animales"
 * is not a URL to it. Deliberately a prefix check rather than `new URL(...)`:
 * this runs while a page renders, and a malformed crumb should quietly produce
 * a slightly wrong breadcrumb rather than throw and take the whole page down.
 */
function absolute(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return url.startsWith("/") ? `${SITE_URL}${url}` : `${SITE_URL}/${url}`;
}

/**
 * BreadcrumbList JSON-LD — the trail a page sits on, e.g.
 *
 *   <BreadcrumbJsonLd
 *     items={[
 *       { name: "Inicio", url: "/" },
 *       { name: "Tatuajes", url: "/work" },
 *       { name: "Animales", url: "/tatuajes/animales" },
 *     ]}
 *   />
 *
 * Pass the crumbs in trail order, home first and the current page last; the
 * positions are numbered here so a caller can never get them out of step with
 * the array. Labels are the caller's job because they are language-specific —
 * this component holds no copy and no route knowledge, which is what lets both
 * the category and the guest-spot pages, in both languages, use it unchanged.
 *
 * What it buys: Google renders the trail in place of the raw URL under a
 * result, so a category page shows "bochatattoo.com › Tatuajes › Animales"
 * instead of a slug, and the page is visibly part of a portfolio rather than a
 * loose page — which is exactly the thing 636 tattoos behind one query
 * parameter failed to communicate.
 */
export function BreadcrumbJsonLd({ items }: { items: Crumb[] }) {
  // A trail with nothing on it is invalid markup, not an empty one.
  if (items.length === 0) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absolute(crumb.url),
    })),
  };

  return (
    <script
      type="application/ld+json"
      // Static, trusted JSON — safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
