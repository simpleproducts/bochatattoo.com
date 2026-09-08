import Link from "next/link";
import { Newsletter } from "./Newsletter";
import { guestSpotsPath } from "@/i18n/routes";
import type { Locale } from "@/i18n";
import type { Dictionary } from "@/i18n/types";

type Props = {
  dict: Dictionary["footer"];
  newsletter: Dictionary["newsletter"];
  locale: Locale;
};

export function Footer({ dict, newsletter, locale }: Props) {
  const year = new Date().getFullYear();
  const rights = dict.rights.replace("{year}", String(year));
  return (
    <footer className="px-6 md:px-10 py-10 border-t border-line mt-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10 mb-10">
        <Newsletter dict={newsletter} />
      </div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-xs uppercase tracking-[0.2em] font-mono text-muted pt-6 border-t border-line">
        <a
          href="#top"
          className="group inline-flex items-center gap-2 hover:text-fg transition-colors"
        >
          <span>{dict.backToTop}</span>
        </a>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {/*
            The guest-spot hub is linked here, in the footer, because it is the
            only link into that cluster from the rest of the site: nothing in
            the nav, the home page or the archive points at it. Without this the
            hub and the six city pages are reachable only through the sitemap —
            indexable in principle, but orphaned, which is most of the reason a
            page fails to rank. The footer renders on every public page through
            SiteShell, so one <li> connects the whole cluster to the site graph.

            "Guest spots" is deliberately not a dictionary key: the term is the
            same word in Spanish and English, and the hub's own copy uses it
            untranslated in both.
          */}
          <li><Link href={guestSpotsPath(locale)} className="hover:text-fg transition-colors">Guest spots</Link></li>
          <li><a href="https://instagram.com/bocha.ttt" target="_blank" rel="noreferrer" className="hover:text-fg transition-colors">Instagram</a></li>
          <li><a href="mailto:info@bochatattoo.com" className="hover:text-fg transition-colors">Email</a></li>
        </ul>
        <span>{rights}</span>
      </div>
    </footer>
  );
}
