import type { Metadata } from "next";
import { WorkPage } from "@/components/WorkPage";
import { ImagesProvider } from "@/components/ImagesProvider";
import { getArchiveImagesData } from "@/lib/images-store";
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

export default async function WorkEn() {
  return (
    <ImagesProvider data={await getArchiveImagesData()}>
      <WorkPage dict={dict} locale={locale} />
    </ImagesProvider>
  );
}
