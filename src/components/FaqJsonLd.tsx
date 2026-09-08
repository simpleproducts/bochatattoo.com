import type { Dictionary } from "@/i18n/types";

/**
 * FAQPage JSON-LD, built from the SAME dictionary entries the visible FAQ
 * renders.
 *
 * The shared source is the entire point, not a convenience. Google only shows
 * (and only trusts) an FAQ answer that a human visiting the page can read in
 * full; markup that says something the page does not is a structured-data
 * violation. Retyping the questions here would work for exactly as long as it
 * took someone to edit one copy and not the other, and the drift would be
 * invisible — the page would still look right. So this component takes
 * `dict.faq.items` and FAQ.tsx renders it: one array, two outputs, no way to
 * change one without changing the other.
 */
export function FaqJsonLd({ items }: { items: Dictionary["faq"]["items"] }) {
  // An FAQPage with no questions is invalid markup, not an empty one.
  if (items.length === 0) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        // Passed through verbatim, markup included: the visible answer is
        // rendered as HTML too, and schema.org's Answer accepts the limited
        // HTML (links, emphasis, lists) the dictionary uses. Stripping tags
        // here would make the two copies differ, which is the one thing this
        // component exists to prevent.
        text: item.a,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      // Static, trusted JSON — safe to inline. The one extra step over the
      // other emitters: "<" is escaped to its JSON unicode form, because these
      // answers are the only payload on the site that may legitimately contain
      // HTML, and a literal "</script>" inside a string would otherwise close
      // this tag early. The escape is invisible to any parser — it decodes
      // back to "<" — so Google still reads the answer the page displays.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
