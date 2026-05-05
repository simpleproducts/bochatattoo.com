import type { Locale } from "@/i18n";

const SITE = "https://bochatattoo.com";

/**
 * LocalBusiness JSON-LD. Values are intentional placeholders — replace with
 * real address, geo, opening hours, phone, and sameAs handles before launch.
 */
export function JsonLd({ locale }: { locale: Locale }) {
  const data = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Person"],
    "@id": `${SITE}#bocha`,
    name: "Bocha",
    alternateName: "Bocha Tattoo",
    description:
      locale === "es"
        ? "Tatuador. Diseños originales, trabajo cuidado, con turno."
        : "Tattoo artist. Original designs, considered work, by appointment.",
    url: locale === "en" ? SITE : `${SITE}/${locale}`,
    image: `${SITE}/opengraph-image`,
    priceRange: "$$",
    inLanguage: locale,
    sameAs: [
      "https://instagram.com/",
      "https://wa.me/",
    ],
    address: {
      "@type": "PostalAddress",
      addressCountry: "AR",
      addressLocality: "Placeholder",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "booking",
      email: "hello@bochatattoo.com",
      availableLanguage: ["en", "es"],
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
