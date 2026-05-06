import type { Metadata } from "next";
import { WorkPage } from "@/components/WorkPage";
import { getDictionary } from "@/i18n";

const locale = "en" as const;
const dict = getDictionary(locale);

export const metadata: Metadata = {
  title: dict.work.metaTitle,
  description: dict.work.metaDescription,
  alternates: {
    canonical: "/en/work",
    languages: {
      es: "/work",
      en: "/en/work",
      "x-default": "/work",
    },
  },
  openGraph: {
    title: dict.work.metaTitle,
    description: dict.work.metaDescription,
    locale: "en_US",
    type: "website",
  },
};

export default function WorkEn() {
  return <WorkPage dict={dict} locale={locale} />;
}
