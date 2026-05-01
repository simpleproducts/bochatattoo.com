"use client";
import { useEffect, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

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
        className={`flex items-center justify-between px-6 md:px-10 transition-all duration-500 text-fg ${
          scrolled ? "py-3" : "py-5"
        }`}
      >
        <a
          href="#top"
          aria-label="Bocha — home"
          className={`font-serif italic tracking-tight transition-all duration-500 ${
            scrolled ? "text-lg md:text-xl" : "text-xl md:text-2xl"
          }`}
        >
          bocha
        </a>

        <ul className="hidden md:flex items-center gap-8 text-xs uppercase tracking-[0.2em] font-mono">
          {[
            ["Work", "#work"],
            ["About", "#about"],
            ["Process", "#process"],
            ["Contact", "#contact"],
          ].map(([label, href]) => (
            <li key={href}>
              <a
                href={href}
                className="nav-link relative inline-block py-1 hover:opacity-100"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#contact"
          className={`hidden md:inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-mono border border-current rounded-full transition-all duration-500 hover:bg-fg hover:text-bg ${
            scrolled ? "px-3 py-1.5" : "px-4 py-2"
          }`}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Book
        </a>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
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

      {/* Mobile drawer */}
      <div
        className={`md:hidden overflow-hidden transition-[max-height] duration-500 ease-out ${
          open ? "max-h-96" : "max-h-0"
        } bg-bg/90 backdrop-blur-xl`}
      >
        <ul className="flex flex-col gap-2 px-6 py-6 text-2xl font-serif">
          {[
            ["Work", "#work"],
            ["About", "#about"],
            ["Process", "#process"],
            ["Contact", "#contact"],
          ].map(([label, href]) => (
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
        </ul>
      </div>
    </header>
  );
}
