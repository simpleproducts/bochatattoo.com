import Link from "next/link";
import { SiteShell } from "./SiteShell";
import { Reveal } from "./Reveal";
import type { Dictionary } from "@/i18n/types";
import type { Locale } from "@/i18n";
import { localePath } from "@/i18n";

type Props = { dict: Dictionary; locale: Locale };

export function FAQPage({ dict, locale }: Props) {
  const faq = dict.faq;
  const home = localePath(locale);
  const titleParts = faq.pageTitle.split("\n");

  // FAQPage rich-result schema — Google surfaces this directly in SERPs.
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: faq.items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <SiteShell dict={dict} locale={locale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />

      {/* Hero */}
      <section className="px-6 md:px-10 pt-32 md:pt-40 pb-16 md:pb-24">
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-end">
          <div className="md:col-span-4 flex flex-col gap-6">
            <Link
              href={home}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg transition-colors w-fit"
            >
              <span aria-hidden>←</span>
              <span>{faq.back}</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {faq.eyebrow}
            </span>
          </div>
          <div className="md:col-span-8">
            <Reveal>
              <h1 className="font-serif italic text-[16vw] md:text-[10vw] leading-[0.85] tracking-tight">
                {titleParts.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-8 max-w-xl text-fg/70 text-lg md:text-xl leading-snug">
                {faq.intro}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Q&A list */}
      <ol className="px-6 md:px-10 border-t border-line">
        {faq.items.map((item, i) => (
          <li
            key={i}
            className="grid md:grid-cols-12 gap-4 md:gap-12 py-10 md:py-16 border-b border-line group"
          >
            <Reveal className="md:col-span-1">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
            </Reveal>
            <Reveal delay={60} className="md:col-span-6">
              <h2 className="font-serif italic text-2xl md:text-4xl leading-[1.05] text-balance">
                {item.q}
              </h2>
            </Reveal>
            <Reveal delay={140} className="md:col-span-5">
              <p
                className="text-base md:text-lg leading-relaxed text-fg/85 max-w-2xl [&_a]:underline [&_a]:hover:opacity-60 [&_a]:transition-opacity"
                dangerouslySetInnerHTML={{ __html: item.a }}
              />
            </Reveal>
          </li>
        ))}
      </ol>

      {/* Closing CTA */}
      <section className="px-6 md:px-10 py-24 md:py-40">
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-baseline">
          <div className="md:col-span-4">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {faq.contactPrompt}
            </span>
          </div>
          <div className="md:col-span-8">
            <Link
              href={`${home}#contact`}
              className="font-serif italic text-4xl md:text-7xl leading-[0.95] tracking-tight inline-block group"
            >
              <span className="border-b border-fg/20 group-hover:border-fg pb-2 transition-colors">
                {faq.contactCta}
              </span>
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
