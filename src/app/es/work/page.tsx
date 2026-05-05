import type { Metadata } from "next";
import { WorkPage } from "@/components/WorkPage";
import { getDictionary } from "@/i18n";

const locale = "es" as const;
const dict = getDictionary(locale);

export const metadata: Metadata = {
  title: dict.work.metaTitle,
  description: dict.work.metaDescription,
  alternates: {
    canonical: "/es/work",
    languages: {
      en: "/work",
      es: "/es/work",
      "x-default": "/work",
    },
  },
  openGraph: {
    title: dict.work.metaTitle,
    description: dict.work.metaDescription,
    locale: "es_ES",
    type: "website",
  },
};

export default function WorkEs() {
  return <WorkPage dict={dict} locale={locale} />;
}
