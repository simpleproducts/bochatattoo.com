import type { Metadata } from "next";
import { HomePage } from "@/components/HomePage";
import { getDictionary } from "@/i18n";

const locale = "es" as const;
const dict = getDictionary(locale);

export const metadata: Metadata = {
  title: dict.meta.title,
  description: dict.meta.description,
  alternates: {
    canonical: "/es",
    languages: {
      en: "/",
      es: "/es",
      "x-default": "/",
    },
  },
  openGraph: {
    title: dict.meta.title,
    description: dict.meta.description,
    locale: "es_ES",
    type: "website",
  },
};

export default function HomeEs() {
  return <HomePage dict={dict} locale={locale} />;
}
