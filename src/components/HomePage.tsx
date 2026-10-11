import { SiteShell } from "./SiteShell";
import { Hero } from "./Hero";
import { Marquee } from "./Marquee";
import { Work } from "./Work";
import { About } from "./About";
import { Process } from "./Process";
import { FAQ } from "./FAQ";
import { Contact } from "./Contact";
import { ImagesProvider } from "./ImagesProvider";
import { getImagesData, pickImages } from "@/lib/images-store";
import { selectFeatured } from "@/lib/featured";
import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n";

export async function HomePage({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const data = await getImagesData();
  const { images, featuredSlugs } = data.manifest;
  const hiddenSet = new Set(
    Object.entries(images)
      .filter(([, entry]) => entry.hidden)
      .map(([slug]) => slug),
  );
  // The strip shows a dozen pieces; ship only those entries, chosen by the
  // same rule Work applies on the client.
  const featured = selectFeatured(
    images,
    hiddenSet,
    data.categoriesData.categories,
    featuredSlugs,
    dict.work.featuredLimit,
  );

  return (
    <SiteShell dict={dict} locale={locale}>
      <Hero dict={dict.hero} />
      <Marquee phrases={dict.marquee} />
      <About dict={dict.about} />
      <ImagesProvider
        data={pickImages(
          data,
          featured.map((img) => img.slug),
        )}
      >
        <Work dict={dict.work} locale={locale} />
      </ImagesProvider>
      <Process dict={dict.process} />
      <FAQ dict={dict.faq} />
      <Contact dict={dict.contact} />
    </SiteShell>
  );
}
