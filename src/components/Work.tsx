"use client";
import { useState } from "react";
import { Placeholder } from "./Placeholder";
import { RemoteImage } from "./RemoteImage";
import { Reveal } from "./Reveal";
import { Lightbox } from "./Lightbox";
import { getImage } from "@/lib/images";
import type { Dictionary, Ratio } from "@/i18n/types";

const RATIO_CLASS: Record<Ratio, string> = {
  portrait: "aspect-[3/4]",
  square: "aspect-square",
  landscape: "aspect-[4/3]",
  tall: "aspect-[2/3]",
};

export function Work({ dict }: { dict: Dictionary["work"] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="work" className="px-6 md:px-10 py-24 md:py-32">
      <Reveal>
        <div className="flex items-baseline justify-between mb-12 md:mb-16">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {dict.eyebrow}
          </span>
          <h2 className="font-serif italic text-3xl md:text-5xl">{dict.title}</h2>
        </div>
      </Reveal>

      <div className="work-grid grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        {dict.pieces.map((p, i) => {
          const entry = getImage(p.slug);
          return (
            <Reveal key={p.slug} delay={(i % 3) * 80}>
              <button
                type="button"
                onClick={() => setOpenIndex(i)}
                aria-label={`${dict.open}: ${p.title}`}
                data-cursor
                className={`relative w-full ${RATIO_CLASS[p.ratio]} bg-line overflow-hidden tile block text-left`}
              >
                {entry ? (
                  <RemoteImage
                    slug={p.slug}
                    alt={p.title}
                    fill
                    sizes="(min-width: 768px) 33vw, 50vw"
                    className="object-cover tile-img"
                  />
                ) : (
                  <Placeholder label={p.title} ratio={p.ratio} index={i + 1} />
                )}
                <div
                  aria-hidden
                  className="tile-overlay absolute inset-0 bg-bg/0 transition-colors duration-500 flex items-end p-4"
                >
                  <span className="opacity-0 -translate-y-2 transition-all duration-500 tile-label text-[10px] uppercase tracking-[0.2em] font-mono text-fg">
                    {String(i + 1).padStart(2, "0")} — {p.title}
                  </span>
                </div>
              </button>
            </Reveal>
          );
        })}
      </div>

      <div className="mt-12 flex justify-end">
        <a
          href="#contact"
          className="text-xs uppercase tracking-[0.2em] font-mono border-b border-current pb-1 hover:opacity-60 transition-opacity"
        >
          {dict.inquire}
        </a>
      </div>

      <Lightbox
        pieces={dict.pieces}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onIndexChange={setOpenIndex}
        labels={dict.lightbox}
      />
    </section>
  );
}
