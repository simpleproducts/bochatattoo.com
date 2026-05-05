import { Reveal } from "./Reveal";
import type { Dictionary } from "@/i18n/types";

export function Aftercare({ dict }: { dict: Dictionary["aftercare"] }) {
  return (
    <section
      id="aftercare"
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

      <Reveal delay={80}>
        <p className="max-w-2xl text-lg md:text-xl text-fg/85 leading-relaxed mb-12 md:mb-16">
          {dict.intro}
        </p>
      </Reveal>

      <ol className="grid md:grid-cols-2 gap-px bg-line border border-line">
        {dict.steps.map((step, i) => (
          <Reveal key={i} delay={(i % 2) * 80}>
            <li className="bg-bg p-6 md:p-8 h-full flex flex-col gap-4">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                {step.n}
              </span>
              <h3 className="font-serif text-2xl md:text-3xl">{step.title}</h3>
              <p className="text-base md:text-lg leading-relaxed text-fg/80">
                {step.body}
              </p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
