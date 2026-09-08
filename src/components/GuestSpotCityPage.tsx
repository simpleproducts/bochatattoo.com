import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "./SiteShell";
import { Reveal } from "./Reveal";
import { BreadcrumbJsonLd } from "./BreadcrumbJsonLd";

import { ENABLED_GUEST_SPOTS, type GuestSpot } from "@/config/guest-spots";
import { DEFAULT_LOCALE, localePath } from "@/i18n";
import { guestSpotsPath, guestSpotCityPath, workPath } from "@/i18n/routes";
import type { Locale } from "@/i18n";
import type { Dictionary } from "@/i18n/types";
import {
  INSTAGRAM_DM_URL,
  INSTAGRAM_HANDLE,
  SITE_EMAIL,
} from "@/lib/site";

/**
 * One guest-spot city: /guest-spots/<slug> and /en/guest-spots/<slug>.
 *
 * WHAT MAKES THESE SIX PAGES DIFFERENT FROM EACH OTHER, which is the whole
 * problem with a set of near-identical location pages: the bulk of each page is
 * the hand-written intro from src/config/guest-spots.ts, which is about that
 * city and only makes sense there, and the meta description is cut from that
 * same intro rather than poured into a template. What is shared between the
 * pages is deliberately kept to the shortest useful form — how to write, and a
 * link to the hub, where the general explanation of a guest spot lives once.
 *
 * THE DATES BLOCK IS RENDERED IN BOTH STATES, NEVER SKIPPED.
 * With dates it is the reason the page exists. Without them it says plainly
 * that no trip is booked and invites a message anyway. Leaving it out when
 * `nextDates` is empty would let a reader assume a visit is scheduled and the
 * site simply forgot to say when, which is the one impression these pages must
 * not leave: someone would plan around a trip that does not exist.
 */

/** Google renders about this much of a description; past it is wasted. */
const MAX_DESCRIPTION = 160;

type CityCopy = {
  metaTitle: (city: string) => string;
  eyebrow: string;
  backToHub: string;
  datesLabel: string;
  noDatesValue: string;
  datesNote: string;
  noDatesNote: (city: string) => string;
  enquireEyebrow: string;
  enquireTitle: string;
  enquireBody: (city: string) => string;
  mailSubject: (city: string) => string;
  hubLink: string;
  archiveLink: string;
  otherCitiesTitle: string;
  crumbHome: string;
  crumbHub: string;
};

const COPY: Record<Locale, CityCopy> = {
  es: {
    metaTitle: (city) => `Guest spot en ${city} — tatuajes de Sebastián Barrena`,
    eyebrow: "Guest spot",
    backToHub: "Guest spots",
    datesLabel: "Próximas fechas",
    noDatesValue: "Sin fechas confirmadas",
    datesNote:
      "Los turnos de un viaje son los que caben en esos días y se llenan por orden de llegada. Si alguno es el tuyo, escribime ahora y no la semana anterior: el diseño se dibuja antes del viaje, no en la sesión.",
    noDatesNote: (city) =>
      `Todavía no hay un viaje agendado a ${city}, y prefiero decirlo así de claro. Escribime igual con tu idea: te aviso cuando haya fecha, y los cupos que se abren los anuncio también por stories de Instagram.`,
    enquireEyebrow: "Consultas",
    enquireTitle: "Escribime",
    enquireBody: (city) =>
      `Con tu idea en dos o tres líneas, la zona del cuerpo, el tamaño aproximado y un par de referencias me alcanza para decirte si entra en el viaje. El mail ya sale con «${city}» en el asunto; si escribís por Instagram, ponelo en la primera línea. Y si tenés días imposibles, decímelo en el mismo mensaje.`,
    mailSubject: (city) => `Guest spot ${city}`,
    hubLink: "Cómo funciona un guest spot →",
    archiveLink: "El archivo completo, ordenado por tema →",
    otherCitiesTitle: "Otras ciudades",
    crumbHome: "Inicio",
    crumbHub: "Guest spots",
  },
  en: {
    metaTitle: (city) => `${city} guest spot — tattoos by Sebastián Barrena`,
    eyebrow: "Guest spot",
    backToHub: "Guest spots",
    datesLabel: "Next dates",
    noDatesValue: "No dates confirmed",
    datesNote:
      "A trip only holds the sessions that fit those days, and they go in the order people write. If one of them is yours, write now rather than the week before — the design gets drawn beforehand, not in the chair.",
    noDatesNote: (city) =>
      `There is no trip to ${city} on the calendar yet, and I would rather say that plainly. Write anyway with your idea: I will let you know when there are dates, and slots that open go up on my Instagram stories too.`,
    enquireEyebrow: "Enquiries",
    enquireTitle: "Get in touch",
    enquireBody: (city) =>
      `Your idea in two or three lines, the placement, a rough size and a couple of references are enough for me to tell you whether it fits the trip. The email goes out with "${city}" already in the subject; if you write on Instagram, put it in the first line. And if some days are impossible for you, say so in the same message.`,
    mailSubject: (city) => `Guest spot ${city}`,
    hubLink: "How a guest spot works →",
    archiveLink: "The full archive, sorted by subject →",
    otherCitiesTitle: "Other cities",
    crumbHome: "Home",
    crumbHub: "Guest spots",
  },
};

/**
 * Cuts a meta description out of the city's own intro.
 *
 * WHY NOT A TEMPLATE with the city name dropped in: six descriptions built from
 * one sentence pattern is the doorway signal in miniature, visible right in the
 * search results. Cutting from the intro gives six genuinely different
 * descriptions, and — more useful day to day — the description follows the
 * config: when the studio rewrites a city's intro, the snippet Google shows
 * changes with it instead of quietly drifting out of step.
 *
 * Whole sentences are packed while they fit, so the snippet ends on a full stop
 * rather than mid-thought. Only an opening sentence longer than the limit falls
 * back to a word-boundary cut with an ellipsis.
 */
function metaDescriptionFrom(intro: string): string {
  if (intro.length <= MAX_DESCRIPTION) return intro;

  // Split on ". " rather than a lookbehind regex: the target is ES2017, and a
  // plain split is enough for prose written as prose.
  const parts = intro.split(". ");
  let packed = "";
  for (const part of parts) {
    const candidate = packed ? `${packed}. ${part}` : part;
    const withStop = candidate.endsWith(".") ? candidate : `${candidate}.`;
    if (withStop.length > MAX_DESCRIPTION) break;
    packed = candidate;
  }
  if (packed) return packed.endsWith(".") ? packed : `${packed}.`;

  const clipped = intro.slice(0, MAX_DESCRIPTION - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const trimmed = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;
  // A dangling comma or dash before an ellipsis reads as a rendering bug.
  return `${trimmed.replace(/[\s,;:—–-]+$/, "")}…`;
}

/** Both languages share the slug, so the alternates are the same everywhere. */
function cityPaths(slug: string): { es: string; en: string } {
  return {
    es: guestSpotCityPath("es", slug),
    en: guestSpotCityPath("en", slug),
  };
}

export function guestSpotCityMetadata(
  spot: GuestSpot,
  locale: Locale,
): Metadata {
  const copy = COPY[locale];
  const city = spot.city[locale];
  const title = copy.metaTitle(city);
  const description = metaDescriptionFrom(spot.intro[locale]);
  const paths = cityPaths(spot.slug);

  return {
    // `absolute`: the title already names the studio, and it must not pick up a
    // second brand suffix if a title template is added to the locale layout.
    title: { absolute: title },
    description,
    alternates: {
      canonical: locale === DEFAULT_LOCALE ? paths.es : paths.en,
      languages: { es: paths.es, en: paths.en, "x-default": paths.es },
    },
    openGraph: {
      title,
      description,
      locale: locale === "es" ? "es_ES" : "en_US",
      type: "website",
    },
  };
}

export function GuestSpotCityPage({
  dict,
  locale,
  spot,
}: {
  dict: Dictionary;
  locale: Locale;
  spot: GuestSpot;
}) {
  const copy = COPY[locale];
  const home = localePath(locale);
  const hub = guestSpotsPath(locale);
  const archive = workPath(locale);
  const city = spot.city[locale];
  const mailto = `mailto:${SITE_EMAIL}?subject=${encodeURIComponent(
    copy.mailSubject(city),
  )}`;
  const others = ENABLED_GUEST_SPOTS.filter((s) => s.slug !== spot.slug);

  return (
    <SiteShell dict={dict} locale={locale}>
      <BreadcrumbJsonLd
        items={[
          { name: copy.crumbHome, url: home },
          { name: copy.crumbHub, url: hub },
          { name: city, url: guestSpotCityPath(locale, spot.slug) },
        ]}
      />

      {/* Hero */}
      <section className="px-6 md:px-10 pt-32 md:pt-40 pb-16 md:pb-24">
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-end">
          <div className="md:col-span-4 flex flex-col gap-6">
            <Link
              href={hub}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg transition-colors w-fit"
            >
              <span aria-hidden>←</span>
              <span>{copy.backToHub}</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {copy.eyebrow} · {spot.country[locale]}
            </span>
          </div>
          <div className="md:col-span-8">
            <Reveal>
              {/* break-words only ever fires on a city name long enough to overflow
                  the line on a phone — insurance against a future config entry,
                  invisible for every city currently in the list. */}
              <h1 className="font-serif italic text-[18vw] md:text-[12vw] leading-[0.85] tracking-tight break-words">
                {city}
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-8 max-w-2xl text-fg/80 text-lg md:text-xl leading-snug">
                {spot.intro[locale]}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Dates — rendered in both states. See the note at the top of the file. */}
      <section className="px-6 md:px-10 py-16 md:py-24 border-y border-line">
        <Reveal>
          <div className="grid md:grid-cols-12 gap-6 md:gap-8 items-baseline">
            <span className="md:col-span-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {spot.nextDates ? copy.datesLabel : copy.noDatesValue}
            </span>
            <div className="md:col-span-9 flex flex-col gap-5">
              {spot.nextDates ? (
                <p className="font-serif text-4xl md:text-6xl leading-[0.95] text-accent">
                  {spot.nextDates}
                </p>
              ) : null}
              <p className="max-w-2xl text-base md:text-lg leading-relaxed text-fg/80">
                {spot.nextDates ? copy.datesNote : copy.noDatesNote(city)}
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Enquiry */}
      <section className="px-6 md:px-10 py-24 md:py-32">
        <Reveal>
          <div className="flex items-baseline justify-between mb-10 gap-4">
            <h2 className="font-serif italic text-3xl md:text-5xl">
              {copy.enquireTitle}
            </h2>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted text-right">
              {copy.enquireEyebrow}
            </span>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <p className="max-w-2xl text-base md:text-lg leading-relaxed text-fg/80">
            {copy.enquireBody(city)}
          </p>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-12 grid md:grid-cols-2 gap-8 md:gap-12 max-w-3xl">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-2">
                {dict.contact.directLabel}
              </p>
              {/* The subject line is pre-filled with the city: on a page whose
                  only job is to start a message, the reader should not have to
                  remember to say which trip they mean. */}
              <a
                href={mailto}
                className="text-lg md:text-xl border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
              >
                {SITE_EMAIL}
              </a>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-2">
                {dict.contact.instagramLabel}
              </p>
              <a
                href={INSTAGRAM_DM_URL}
                target="_blank"
                rel="noreferrer"
                className="text-lg md:text-xl border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
              >
                @{INSTAGRAM_HANDLE}
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-12 flex flex-col sm:flex-row gap-6 sm:gap-10 text-xs uppercase tracking-[0.2em] font-mono">
            <Link
              href={hub}
              className="text-muted hover:text-fg transition-colors w-fit"
            >
              {copy.hubLink}
            </Link>
            <Link
              href={archive}
              className="text-muted hover:text-fg transition-colors w-fit"
            >
              {copy.archiveLink}
            </Link>
          </div>
        </Reveal>
      </section>

      {others.length > 0 ? (
        <section className="px-6 md:px-10 py-16 md:py-20 border-t border-line">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {copy.otherCitiesTitle}
            </span>
          </Reveal>
          <Reveal delay={80}>
            <ul className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-4">
              {others.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={guestSpotCityPath(locale, other.slug)}
                    className="font-serif text-2xl md:text-3xl text-muted hover:text-fg transition-colors"
                  >
                    {other.city[locale]}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>
      ) : null}
    </SiteShell>
  );
}
