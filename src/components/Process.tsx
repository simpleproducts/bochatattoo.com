import { Reveal } from "./Reveal";
import type { Dictionary } from "@/i18n/types";

export function Process({ dict }: { dict: Dictionary["process"] }) {
  return (
    <section
      id="process"
      className="px-6 md:px-10 py-24 md:py-32 border-t border-line"
    >
      <Reveal>
        <div className="flex items-baseline justify-between mb-12 md:mb-16">
          <h2 className="font-serif italic text-3xl md:text-5xl">{dict.title}</h2>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {dict.eyebrow}
          </span>
        </div>
      </Reveal>

      <ol className="divide-y divide-line border-y border-line">
        {dict.steps.map((step, i) => (
          <Reveal key={step.n} delay={i * 60}>
            <li className="grid md:grid-cols-12 gap-4 md:gap-8 py-8 md:py-10">
              <span className="md:col-span-2 font-mono text-xs uppercase tracking-[0.2em] text-muted pt-1">
                {step.n}
              </span>
              <h3 className="md:col-span-3 font-serif text-2xl md:text-3xl">
                {step.title}
              </h3>
              <p className="md:col-span-7 text-base md:text-lg leading-relaxed text-fg/80 max-w-2xl">
                {step.body}
              </p>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
