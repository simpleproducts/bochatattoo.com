import { Reveal } from "./Reveal";
import type { Dictionary } from "@/i18n/types";

export function Contact({ dict }: { dict: Dictionary["contact"] }) {
  return (
    <section
      id="contact"
      className="px-6 md:px-10 py-24 md:py-40 border-t border-line"
    >
      <Reveal>
        <div className="flex items-baseline justify-between mb-10">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {dict.eyebrow}
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {dict.status}
          </span>
        </div>
      </Reveal>

      <Reveal>
        <h2 className="font-serif text-[14vw] md:text-[10vw] leading-[0.9] tracking-tight">
          {dict.title1} <span className="italic text-muted">{dict.title2}</span>
        </h2>
      </Reveal>

      <Reveal delay={120}>
        <div className="mt-12 grid md:grid-cols-2 gap-8 md:gap-12 max-w-3xl">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-2">
              {dict.directLabel}
            </p>
            <a
              href="mailto:info@bochatattoo.com"
              className="text-lg md:text-xl border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
            >
              info@bochatattoo.com
            </a>
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-2">
              {dict.instagramLabel}
            </p>
            <a
              href="https://instagram.com/bocha.ttt"
              target="_blank"
              rel="noreferrer"
              className="text-lg md:text-xl border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
            >
              @bocha.ttt
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
