import { SiteShell } from "./SiteShell";
import { Hero } from "./Hero";
import { Marquee } from "./Marquee";
import { Work } from "./Work";
import { About } from "./About";
import { Process } from "./Process";
import { FAQ } from "./FAQ";
import { Contact } from "./Contact";
import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n";

export function HomePage({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <SiteShell dict={dict} locale={locale}>
      <Hero dict={dict.hero} />
      <Marquee phrases={dict.marquee} />
      <About dict={dict.about} />
      <Work dict={dict.work} locale={locale} />
      <Process dict={dict.process} />
      <FAQ dict={dict.faq} />
      <Contact dict={dict.contact} />
    </SiteShell>
  );
}
