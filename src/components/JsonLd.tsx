import { DEFAULT_LOCALE } from "@/i18n";
import type { Locale } from "@/i18n";
import { STUDIO } from "@/config/studio";
import { ENABLED_GUEST_SPOTS } from "@/config/guest-spots";

const SITE = "https://bochatattoo.com";

/**
 * LocalBusiness + Person JSON-LD for Bocha.
 *
 * Everything emitted here is either an established fact or a value the studio
 * itself put in src/config/studio.ts. The NAP fields — street, postcode,
 * phone, opening hours — are spread in CONDITIONALLY: while a config value is
 * "" the property is absent from the JSON entirely, rather than present as an
 * empty string. That distinction matters more than it looks. Google matches a
 * site to a Business Profile by comparing these fields; an empty or wrong
 * `telephone` does not read as "unknown", it reads as a contradiction and
 * breaks the match, which costs more ranking than the missing field ever did.
 * Absent is honest. Empty is a claim that the studio has no phone.
 *
 * `geo` is unconditional, but the point it publishes is Medrano station, NOT
 * the studio — see src/config/studio.ts. This is a private studio whose address
 * a client receives by message after their appointment is confirmed, and
 * coordinates are an address: a seven-decimal `geo` puts a pin on the door for
 * anyone who reads this page's source. The nearest Subte stop is 200 m away,
 * is true, and gives Google the same Almagro proximity signal without
 * publishing what the studio deliberately does not publish.
 */
export function JsonLd({ locale }: { locale: Locale }) {
  const data = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "TattooParlor"],
    "@id": `${SITE}#bocha`,
    name: "Sebastián Barrena",
    alternateName: "Bocha Tattoo",
    description:
      locale === "es"
        ? "Tatuador especializado en microrealismo ilustrativo. Fineline, precisión y texturas sutiles. Estudio privado en Almagro, Buenos Aires."
        : "Tattoo artist specializing in illustrative microrealism. Fineline, precision, soft shadows and subtle textures. Private studio in Almagro, Buenos Aires.",
    url: locale === DEFAULT_LOCALE ? SITE : `${SITE}/${locale}`,
    image: `${SITE}/opengraph-image`,
    logo: `${SITE}/icon`,
    foundingDate: "2015",
    inLanguage: locale,
    sameAs: ["https://instagram.com/bocha.ttt"],
    address: {
      "@type": "PostalAddress",
      // Spread first so the property order reads street → locality → region →
      // postcode → country, the way a postal address is actually written.
      ...(STUDIO.streetAddress ? { streetAddress: STUDIO.streetAddress } : {}),
      addressLocality: "Almagro",
      addressRegion: "Ciudad Autónoma de Buenos Aires",
      ...(STUDIO.postalCode ? { postalCode: STUDIO.postalCode } : {}),
      addressCountry: "AR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: STUDIO.lat,
      longitude: STUDIO.lng,
    },
    ...(STUDIO.telephone ? { telephone: STUDIO.telephone } : {}),
    ...(STUDIO.openingHours.length > 0
      ? {
          openingHoursSpecification: STUDIO.openingHours.map((block) => ({
            "@type": "OpeningHoursSpecification",
            // schema.org wants the capitalised English day tokens; studio.ts
            // documents that requirement at the point where they get typed in.
            dayOfWeek: block.days,
            opens: block.opens,
            closes: block.closes,
          })),
        }
      : {}),
    // Driven by the guest-spot config rather than a hardcoded list, so a city
    // is claimed here only while it has a page behind it. Retiring a city with
    // `enabled: false` drops it from the pages, the sitemap and this claim in
    // one move — an areaServed for a city Bocha no longer visits is a promise
    // the site cannot keep.
    areaServed: [
      { "@type": "City", name: "Buenos Aires" },
      ...ENABLED_GUEST_SPOTS.map((spot) => ({
        "@type": "City",
        name: spot.city[locale],
      })),
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "booking",
      email: "info@bochatattoo.com",
      availableLanguage: ["en", "es"],
    },
    founder: {
      "@type": "Person",
      name: "Sebastián Barrena",
      alternateName: "Bocha",
    },
  };

  return (
    <script
      type="application/ld+json"
      // Static, trusted JSON — safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
