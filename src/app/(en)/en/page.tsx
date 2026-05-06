import type { Metadata } from "next";
import { HomePage } from "@/components/HomePage";
import { getDictionary } from "@/i18n";

const locale = "en" as const;
const dict = getDictionary(locale);

export const metadata: Metadata = {
  title: dict.meta.title,
  description: dict.meta.description,
  alternates: {
    canonical: "/en",
    languages: {
      es: "/",
      en: "/en",
      "x-default": "/",
    },
  },
  openGraph: {
    title: dict.meta.title,
    description: dict.meta.description,
    locale: "en_US",
    type: "website",
  },
};

export default function HomeEn() {
  return <HomePage dict={dict} locale={locale} />;
}
