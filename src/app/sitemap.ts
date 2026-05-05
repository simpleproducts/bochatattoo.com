import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n";

const BASE = "https://bochatattoo.com";
type Segment = "" | "/work" | "/faq";
const SEGMENTS: Segment[] = ["", "/work", "/faq"];

function pathFor(locale: string, segment: Segment): string {
  const prefix = locale === "en" ? "" : `/${locale}`;
  return `${BASE}${prefix}${segment === "" ? "/" : segment}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return SEGMENTS.flatMap((segment) => {
    const languages = Object.fromEntries(
      LOCALES.map((l) => [l, pathFor(l, segment)]),
    );
    return LOCALES.map((l) => ({
      url: pathFor(l, segment),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: segment === "" ? (l === "en" ? 1 : 0.9) : l === "en" ? 0.8 : 0.7,
      alternates: { languages },
    }));
  });
}
