import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n";

const BASE = "https://bochatattoo.com";

function pathFor(locale: string, segment: "" | "/faq"): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return `${BASE}${prefix}${segment === "" ? "/" : segment}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const homeLanguages = Object.fromEntries(
    LOCALES.map((l) => [l, pathFor(l, "")]),
  );
  const faqLanguages = Object.fromEntries(
    LOCALES.map((l) => [l, pathFor(l, "/faq")]),
  );

  return [
    ...LOCALES.map((l) => ({
      url: pathFor(l, ""),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: l === "en" ? 1 : 0.9,
      alternates: { languages: homeLanguages },
    })),
    ...LOCALES.map((l) => ({
      url: pathFor(l, "/faq"),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: l === "en" ? 0.8 : 0.7,
      alternates: { languages: faqLanguages },
    })),
  ];
}
