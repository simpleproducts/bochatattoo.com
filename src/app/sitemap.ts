import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n";

const BASE = "https://bochatattoo.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const languages = Object.fromEntries(
    LOCALES.map((l) => [l, l === "en" ? `${BASE}/` : `${BASE}/${l}`]),
  );

  return LOCALES.map((l) => ({
    url: l === "en" ? `${BASE}/` : `${BASE}/${l}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: l === "en" ? 1 : 0.9,
    alternates: { languages },
  }));
}
