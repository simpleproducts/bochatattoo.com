import type { Metadata } from "next";
import { FAQPage } from "@/components/FAQPage";
import { getDictionary } from "@/i18n";

const locale = "es" as const;
const dict = getDictionary(locale);

export const metadata: Metadata = {
  title: dict.faq.metaTitle,
  description: dict.faq.metaDescription,
  alternates: {
    canonical: "/faq",
    languages: {
      es: "/faq",
      en: "/en/faq",
      "x-default": "/faq",
    },
  },
  openGraph: {
    title: dict.faq.metaTitle,
    description: dict.faq.metaDescription,
    locale: "es_ES",
    type: "website",
  },
};

export default function FAQ() {
  return <FAQPage dict={dict} locale={locale} />;
}
