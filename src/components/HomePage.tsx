import { Nav } from "./Nav";
import { Hero } from "./Hero";
import { Marquee } from "./Marquee";
import { Work } from "./Work";
import { About } from "./About";
import { Process } from "./Process";
import { Aftercare } from "./Aftercare";
import { FAQ } from "./FAQ";
import { Contact } from "./Contact";
import { Footer } from "./Footer";
import { HtmlLang } from "./HtmlLang";
import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n";

export function HomePage({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <>
      <HtmlLang locale={locale} />
      <Nav dict={dict.nav} locale={locale} switcherLabel={dict.localeSwitcher.label} />
      <main className="flex-1">
        <Hero dict={dict.hero} />
        <Marquee phrases={dict.marquee} />
        <Work dict={dict.work} />
        <About dict={dict.about} />
        <Process dict={dict.process} />
        <Aftercare dict={dict.aftercare} />
        <FAQ dict={dict.faq} />
        <Contact dict={dict.contact} />
      </main>
      <Footer dict={dict.footer} />
    </>
  );
}
