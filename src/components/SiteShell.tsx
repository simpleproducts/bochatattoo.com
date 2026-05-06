import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { HtmlLang } from "./HtmlLang";
import { JsonLd } from "./JsonLd";
import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n";

type Props = {
  dict: Dictionary;
  locale: Locale;
  children: React.ReactNode;
};

export function SiteShell({ dict, locale, children }: Props) {
  return (
    <>
      <JsonLd locale={locale} />
      <HtmlLang locale={locale} />
      <Nav
        dict={dict.nav}
        locale={locale}
        switcherLabel={dict.localeSwitcher.label}
      />
      <main className="flex-1">{children}</main>
      <Footer dict={dict.footer} newsletter={dict.newsletter} />
    </>
  );
}
