"use client";
import { useEffect, useState } from "react";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Magnetic } from "./Magnetic";
import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n";

type Props = {
  dict: Dictionary["nav"];
  locale: Locale;
  switcherLabel: string;
};

export function Nav({ dict, locale, switcherLabel }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  const items: [string, string][] = [
    [dict.work, "#work"],
    [dict.about, "#about"],
    [dict.process, "#process"],
    [dict.aftercare, "#aftercare"],
    [dict.faq, "#faq"],
    [dict.contact, "#contact"],
  ];

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const docH = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(docH > 0 ? window.scrollY / docH : 0);
        setScrolled(window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background,backdrop-filter,border-color,padding] duration-500 ${
        scrolled
          ? "bg-bg/65 backdrop-blur-xl border-b border-line"
          : "border-b border-transparent mix-blend-difference"
      }`}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 h-px bg-fg"
        style={{
          width: `${progress * 100}%`,
          transition: "width 80ms linear",
          opacity: scrolled ? 0.7 : 0,
        }}
      />

      <nav
        className={`flex items-center justify-between gap-6 px-6 md:px-10 transition-all duration-500 text-fg ${
          scrolled ? "py-3" : "py-5"
        }`}
      >
        <a
          href="#top"
          aria-label="Bocha Tattoo"
          className={`font-serif italic tracking-tight transition-all duration-500 ${
            scrolled ? "text-lg md:text-xl" : "text-xl md:text-2xl"
          }`}
        >
          bocha
        </a>

        <ul className="hidden lg:flex items-center gap-6 xl:gap-8 text-xs uppercase tracking-[0.2em] font-mono">
          {items.map(([label, href]) => (
            <li key={href}>
              <a href={href} className="nav-link relative inline-block py-1">
                {label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-6">
          <LocaleSwitcher current={locale} label={switcherLabel} />
          <Magnetic strength={0.35} range={60}>
            <a
              href="#contact"
              className={`inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-mono border border-current rounded-full transition-all duration-500 hover:bg-fg hover:text-bg ${
                scrolled ? "px-3 py-1.5" : "px-4 py-2"
              }`}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              {dict.book}
            </a>
          </Magnetic>
        </div>

        <button
          type="button"
          aria-label={open ? dict.menuClose : dict.menuOpen}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden flex flex-col gap-1.5 p-2 -mr-2"
        >
          <span
            className={`block h-px w-6 bg-current transition-transform duration-300 ${
              open ? "translate-y-[3px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-px w-6 bg-current transition-transform duration-300 ${
              open ? "-translate-y-[3px] -rotate-45" : ""
            }`}
          />
        </button>
      </nav>

      <div
        className={`md:hidden overflow-hidden transition-[max-height] duration-500 ease-out ${
          open ? "max-h-[32rem]" : "max-h-0"
        } bg-bg/90 backdrop-blur-xl`}
      >
        <ul className="flex flex-col gap-2 px-6 py-6 text-2xl font-serif">
          {items.map(([label, href]) => (
            <li key={href}>
              <a
                href={href}
                onClick={() => setOpen(false)}
                className="block py-2"
              >
                {label}
              </a>
            </li>
          ))}
          <li className="pt-4 border-t border-line mt-2">
            <LocaleSwitcher current={locale} label={switcherLabel} />
          </li>
        </ul>
      </div>
    </header>
  );
}
