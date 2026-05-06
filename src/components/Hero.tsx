import { HeroBackground } from "./HeroBackground";
import { Reveal } from "./Reveal";
import { SplitText } from "./SplitText";
import { BookingBadge } from "./BookingBadge";
import type { Dictionary } from "@/i18n/types";

export function Hero({ dict }: { dict: Dictionary["hero"] }) {
  return (
    <section
      id="top"
      className="relative min-h-screen flex flex-col justify-end px-6 md:px-10 pb-16 pt-32 overflow-hidden"
    >
      <HeroBackground />

      <div className="relative flex items-start justify-between gap-8 mb-10 text-xs uppercase tracking-[0.2em] font-mono text-fg/60">
        <span>{dict.badge}</span>
        <span className="hidden md:inline">{dict.location}</span>
      </div>

      <h1 className="font-serif leading-[0.85] tracking-tight text-[18vw] md:text-[12vw]">
        <span className="block overflow-hidden">
          <SplitText delay={300} stagger={55}>
            {dict.title1}
          </SplitText>
        </span>
        <span className="block text-fg/55 overflow-hidden">
          <SplitText delay={550} stagger={55}>
            {dict.title2}
          </SplitText>
        </span>
      </h1>

      <div className="relative z-10 mt-10 grid md:grid-cols-3 gap-6 md:gap-10 items-end">
        <Reveal delay={500} className="md:col-span-2">
          <p className="max-w-xl text-balance text-lg md:text-xl leading-snug">
            {dict.intro}
          </p>
        </Reveal>
        <Reveal delay={600}>
          <a
            href="#work"
            className="self-end inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono group"
          >
            <span>{dict.cta}</span>
            <span
              aria-hidden
              className="inline-block w-10 h-px bg-current transition-all group-hover:w-16"
            />
          </a>
        </Reveal>
      </div>

      {/* Floating circular booking badge — links to contact */}
      <div
        className="absolute right-6 md:right-10 top-28 md:top-32 hidden sm:block opacity-0 animate-fade-in"
        style={{ animationDelay: "1400ms" }}
      >
        <BookingBadge
          text={dict.booking}
          href="#contact"
          ariaLabel={dict.booking}
        />
      </div>

      <div
        aria-hidden
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] font-mono text-fg/50"
      >
        <span>{dict.scroll}</span>
        <span className="block h-8 w-px bg-current animate-scroll-cue origin-top" />
      </div>
    </section>
  );
}
