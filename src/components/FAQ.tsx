"use client";
import { useState } from "react";
import { Reveal } from "./Reveal";
import type { Dictionary } from "@/i18n/types";

export function FAQ({ dict }: { dict: Dictionary["faq"] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="px-6 md:px-10 py-24 md:py-32 border-t border-line"
    >
      <Reveal>
        <div className="flex items-baseline justify-between mb-12 md:mb-16">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {dict.eyebrow}
          </span>
          <h2 className="font-serif italic text-3xl md:text-5xl">{dict.title}</h2>
        </div>
      </Reveal>

      <ul className="border-y border-line divide-y divide-line max-w-4xl">
        {dict.items.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-${i}`}
                className="w-full flex items-baseline justify-between gap-6 py-6 md:py-8 text-left group"
              >
                <span className="font-serif text-xl md:text-2xl">
                  {item.q}
                </span>
                <span
                  aria-hidden
                  className={`flex-shrink-0 w-8 h-8 flex items-center justify-center text-lg border border-line rounded-full transition-transform duration-300 ${
                    isOpen ? "rotate-45 bg-fg text-bg border-fg" : "group-hover:bg-fg/5"
                  }`}
                >
                  +
                </span>
              </button>
              <div
                id={`faq-${i}`}
                className={`grid transition-[grid-template-rows] duration-500 ease-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="pb-6 md:pb-8 max-w-2xl text-base md:text-lg leading-relaxed text-fg/80">
                    {item.a}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
