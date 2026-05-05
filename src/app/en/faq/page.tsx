import type { Metadata } from "next";
import { FAQPage } from "@/components/FAQPage";
import { getDictionary } from "@/i18n";

const locale = "en" as const;
const dict = getDictionary(locale);

export const metadata: Metadata = {
  title: dict.faq.metaTitle,
  description: dict.faq.metaDescription,
  alternates: {
    canonical: "/en/faq",
    languages: {
      es: "/faq",
      en: "/en/faq",
      "x-default": "/faq",
    },
  },
  openGraph: {
    title: dict.faq.metaTitle,
    description: dict.faq.metaDescription,
    locale: "en_US",
    type: "website",
  },
};

export default function FAQEn() {
  return <FAQPage dict={dict} locale={locale} />;
}
