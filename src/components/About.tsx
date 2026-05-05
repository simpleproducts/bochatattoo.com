import { Reveal } from "./Reveal";
import type { Dictionary } from "@/i18n/types";

export function About({ dict }: { dict: Dictionary["about"] }) {
  const meta = dict.meta;
  return (
    <section
      id="about"
      className="px-6 md:px-10 py-24 md:py-32 border-t border-line"
    >
      <div className="grid md:grid-cols-12 gap-8 md:gap-12">
        <Reveal className="md:col-span-5">
          <figure className="relative aspect-[3/4] overflow-hidden bg-line">
            <picture>
              <source srcSet="/site/about-me.avif" type="image/avif" />
              <source srcSet="/site/about-me.webp" type="image/webp" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/site/about-me.jpg"
                alt={dict.portraitAlt}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </picture>
          </figure>
        </Reveal>

        <div className="md:col-span-7 flex flex-col justify-between gap-12">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {dict.eyebrow}
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h2 className="font-serif text-4xl md:text-6xl leading-[0.95]">
              {dict.headingPart1}{" "}
              <span className="italic text-muted">{dict.headingPart2}</span>
            </h2>
          </Reveal>

          <Reveal delay={160}>
            <div className="grid sm:grid-cols-2 gap-6 text-base md:text-lg leading-relaxed text-fg/85 max-w-3xl">
              <p>{dict.intro1}</p>
              <p>{dict.intro2}</p>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-line text-xs uppercase tracking-[0.2em] font-mono text-muted">
              {([meta.based, meta.style, meta.booking, meta.since] as const).map(
                ([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd className="text-fg mt-1 normal-case tracking-normal font-sans text-sm">
                      {value}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
