import { DEFAULT_LOCALE } from "@/i18n";
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
