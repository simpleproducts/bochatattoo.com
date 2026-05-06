import { Newsletter } from "./Newsletter";
import type { Dictionary } from "@/i18n/types";

type Props = {
  dict: Dictionary["footer"];
  newsletter: Dictionary["newsletter"];
};

export function Footer({ dict, newsletter }: Props) {
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
          <li><a href="https://instagram.com/bocha.ttt" target="_blank" rel="noreferrer" className="hover:text-fg transition-colors">Instagram</a></li>
          <li><a href="mailto:info@bochatattoo.com" className="hover:text-fg transition-colors">Email</a></li>
        </ul>
        <span>{rights}</span>
      </div>
    </footer>
  );
}
