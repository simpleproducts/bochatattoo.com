import type { Locale } from "@/i18n";

const SITE = "https://bochatattoo.com";

/**
 * LocalBusiness + Person JSON-LD for Bocha. Real values are filled in here;
 * email/phone/sameAs handles are placeholders until provided.
 */
export function JsonLd({ locale }: { locale: Locale }) {
  const data = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "TattooParlor"],
    "@id": `${SITE}#bocha`,
    name: "Bocha",
    alternateName: "Bocha Tattoo",
    description:
      locale === "es"
        ? "Tatuador en Almagro, Ciudad de Buenos Aires, desde 2015"
        : "Tattoo artist in Almagro, Buenos Aires since 2015. Considered, custom work by appointment.",
    url: locale === "en" ? SITE : `${SITE}/${locale}`,
    image: `${SITE}/opengraph-image`,
    logo: `${SITE}/icon`,
    foundingDate: "2015",
    priceRange: "$$",
    inLanguage: locale,
    sameAs: [
      "https://instagram.com/",
      "https://wa.me/",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Almagro",
      addressRegion: "Ciudad Autónoma de Buenos Aires",
      addressCountry: "AR",
    },
    areaServed: [
      { "@type": "City", name: "Buenos Aires" },
      { "@type": "City", name: "Berlin" },
      { "@type": "City", name: "Madrid" },
      { "@type": "City", name: "Barcelona" },
      { "@type": "City", name: "Colonia" },
      { "@type": "City", name: "Freiburgo" },
      { "@type": "City", name: "Basilea" },
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "booking",
      email: "hello@bochatattoo.com",
      availableLanguage: ["en", "es"],
    },
    founder: {
      "@type": "Person",
      name: "Bocha",
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
