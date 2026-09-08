import Link from "next/link";
import type { Metadata } from "next";
import { SiteShell } from "./SiteShell";
import { Reveal } from "./Reveal";
import { BreadcrumbJsonLd } from "./BreadcrumbJsonLd";
import { ENABLED_GUEST_SPOTS } from "@/config/guest-spots";
import { localePath } from "@/i18n";
import { guestSpotsPath, guestSpotCityPath } from "@/i18n/routes";
import type { Locale } from "@/i18n";
import type { Dictionary } from "@/i18n/types";
import { INSTAGRAM_DM_URL, INSTAGRAM_HANDLE, SITE_EMAIL } from "@/lib/site";

/**
 * The guest-spot hub: /guest-spots and /en/guest-spots.
 *
 * WHY THE EXPLANATION LIVES HERE AND NOT ON THE CITY PAGES.
 * Everything general about a guest spot — what one is, how the calendar works,
 * why the design has to be finished before the flight, what to put in the first
 * message — is written once, on this page. A city page then only carries what is
 * true of that city plus its dates. Copying this explainer onto six city pages
 * would have produced six pages that are ninety percent the same text with a
 * place name swapped in, which is the doorway pattern Google demotes; keeping it
 * in one place is both better for a reader and the reason the city pages can be
 * short without being thin.
 *
 * The page reads ENABLED_GUEST_SPOTS, never GUEST_SPOTS: a city retired with
 * `enabled: false` has to vanish from the hub in the same move it vanishes from
 * the sitemap, or the hub keeps linking at a page that 404s.
 */

/**
 * Page copy, both languages side by side.
 *
 * WHY IT IS NOT IN src/i18n: the Dictionary type is a shared contract used by
 * every page on the site, and these strings belong to two routes. Keeping them
 * next to the markup they fill means the Spanish and the English of a sentence
 * are edited within three lines of each other, which is the only reliable way
 * the two stay saying the same thing.
 */
type HubCopy = {
  metaTitle: string;
  /** Takes the enabled city names already joined, so the description names the
   *  cities that actually have pages rather than a list that can go stale. */
  metaDescription: (cities: string) => string;
  eyebrow: string;
  heading: string;
  lead: string;
  howEyebrow: string;
  howTitle: string;
  steps: { n: string; title: string; body: string }[];
  citiesEyebrow: string;
  citiesTitle: string;
  datesLabel: string;
  noDates: string;
  elsewhereEyebrow: string;
  elsewhereTitle: string;
  elsewhereBody: string;
  crumbHome: string;
  crumbSelf: string;
};

const COPY: Record<Locale, HubCopy> = {
  es: {
    metaTitle: "Guest spots · Sebastián Barrena · Dónde tatúo cuando viajo",
    metaDescription: (cities) =>
      `Las ciudades donde tatúo cuando viajo: ${cities}. Cómo funciona un guest spot y qué mandarme al escribir.`,
    eyebrow: "Guest spots",
    heading: "Guest spots.",
    lead: "Además del estudio en Almagro, viajo a tatuar a otras ciudades. Eso es un guest spot: unos días trabajando lejos de casa, con los diseños resueltos antes de salir y los turnos contados —los que entran en el viaje, y ni uno más. Estas son las ciudades a las que voy.",
    howEyebrow: "Antes de escribir",
    howTitle: "Cómo funciona",
    steps: [
      {
        n: "01",
        title: "Qué es",
        body: "Un guest spot es una visita: durante unos días tatúo en otra ciudad en lugar de en mi estudio de Almagro. El trabajo es el mismo —microrealismo ilustrativo y fineline, la misma mano y la misma máquina—; lo que cambia es que la ventana es corta y la dirección se confirma junto con el turno.",
      },
      {
        n: "02",
        title: "Las fechas mandan",
        body: "Un viaje son unos días, no un año de agenda. Cuando hay fechas confirmadas para una ciudad están en la página de esa ciudad; cuando no las hay, la página lo dice en vez de inventarlas. Los cupos que se abren los aviso además por stories de Instagram.",
      },
      {
        n: "03",
        title: "El diseño va antes que el avión",
        body: "No hay margen para empezar el dibujo el día de la sesión: lo hablamos por mensaje con semanas de anticipación y llego con el diseño resuelto. Por eso conviene escribir apenas aparecen las fechas y no la semana anterior, cuando ya no queda lugar para dibujar.",
      },
      {
        n: "04",
        title: "Qué mandarme",
        body: "Tu idea en dos o tres líneas, la zona del cuerpo, el tamaño aproximado en centímetros y las referencias que tengas. Con eso te digo si entra en los días que voy a estar y te paso un presupuesto para ese proyecto.",
      },
    ],
    citiesEyebrow: "Dónde tatúo de visita",
    citiesTitle: "Ciudades",
    datesLabel: "Próximas fechas",
    noDates: "Sin fechas confirmadas",
    elsewhereEyebrow: "Otras ciudades",
    elsewhereTitle: "¿Tu ciudad no está en la lista?",
    elsewhereBody:
      "Escribime igual. Los viajes se arman en buena parte con las consultas que llegan: si en tu ciudad hay varias personas interesadas, contámelo en el mismo mensaje y decime en qué meses les vendría bien.",
    crumbHome: "Inicio",
    crumbSelf: "Guest spots",
  },
  en: {
    metaTitle: "Guest spots · Sebastián Barrena · The cities I travel to",
    metaDescription: (cities) =>
      `The cities I travel to for guest spots: ${cities}. How a guest spot works and what to send when you write.`,
    eyebrow: "Guest spots",
    heading: "Guest spots.",
    lead: "Alongside the studio in Almagro, I travel to tattoo in other cities. That is what a guest spot is: a few days working away from home, with the designs settled before I leave and a counted number of appointments — as many as fit the trip, and not one more. These are the cities I go to.",
    howEyebrow: "Before you write",
    howTitle: "How it works",
    steps: [
      {
        n: "01",
        title: "What it is",
        body: "A guest spot is a visit: for a few days I tattoo in another city instead of in my studio in Almagro. The work is the same — illustrative microrealism and fineline, the same hand and the same machine — what changes is that the window is short and the address is confirmed along with the appointment.",
      },
      {
        n: "02",
        title: "The dates decide everything",
        body: "A trip is a handful of days, not a year of calendar. When a city has confirmed dates they are on that city's page; when it does not, the page says so instead of inventing them. Slots that open up also go up on my Instagram stories.",
      },
      {
        n: "03",
        title: "The design comes before the flight",
        body: "There is no room to start drawing on the day of the session: we settle it over messages weeks ahead and I land with the design done. Which is why it is worth writing the week the dates appear rather than the week before the trip, when there is no drawing time left.",
      },
      {
        n: "04",
        title: "What to send me",
        body: "Your idea in two or three lines, the placement, a rough size in centimetres and whatever references you have. With that I can tell you whether it fits the days I will be there, and come back with a quote for that piece.",
      },
    ],
    citiesEyebrow: "Where I tattoo on the road",
    citiesTitle: "Cities",
    datesLabel: "Next dates",
    noDates: "No dates confirmed",
    elsewhereEyebrow: "Anywhere else",
    elsewhereTitle: "Your city is not on the list?",
    elsewhereBody:
      "Write anyway. Trips get built in large part out of the messages that arrive: if there are several of you in the same city, say so in the same message and tell me which months would suit you.",
    crumbHome: "Home",
    crumbSelf: "Guest spots",
  },
};

/**
 * "Berlín, Madrid y Basilea" / "Berlin, Madrid and Basel".
 *
 * A function rather than a template literal because Spanish turns "y" into "e"
 * before a word that opens on an i- sound ("Madrid e Ibiza"), and the city list
 * comes from a config the studio edits — the day someone adds Ibiza, this keeps
 * the meta description from reading like a typo.
 */
function joinCities(names: string[], locale: Locale): string {
  if (names.length <= 1) return names.join("");
  const head = names.slice(0, -1).join(", ");
  const last = names[names.length - 1];
  if (locale !== "es") return `${head} and ${last}`;
  // "hie-" keeps the y: "hierro", not "e hierro".
  const conjunction = /^h?i(?!e)/i.test(last) ? "e" : "y";
  return `${head} ${conjunction} ${last}`;
}

/** Built here so the route files stay a locale and a default export. */
export function guestSpotsMetadata(locale: Locale): Metadata {
  const copy = COPY[locale];
  const cities = joinCities(
    ENABLED_GUEST_SPOTS.map((spot) => spot.city[locale]),
    locale,
  );
  const description = copy.metaDescription(cities);

  return {
    // `absolute` because these titles already carry the studio's name in full.
    // If a title template is ever added to the locale layout, this page must
    // not end up branded twice.
    title: { absolute: copy.metaTitle },
    description,
    alternates: {
      canonical: guestSpotsPath(locale),
      languages: {
        es: "/guest-spots",
        en: "/en/guest-spots",
        "x-default": "/guest-spots",
      },
    },
    openGraph: {
      title: copy.metaTitle,
      description,
      locale: locale === "es" ? "es_ES" : "en_US",
      type: "website",
    },
  };
}

export function GuestSpotsPage({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const copy = COPY[locale];
  const home = localePath(locale);
  const hub = guestSpotsPath(locale);
  const spots = ENABLED_GUEST_SPOTS;

  return (
    <SiteShell dict={dict} locale={locale}>
      <BreadcrumbJsonLd
        items={[
          { name: copy.crumbHome, url: home },
          { name: copy.crumbSelf, url: hub },
        ]}
      />

      {/* Hero — same two-column proportions as the /work hero. */}
      <section className="px-6 md:px-10 pt-32 md:pt-40 pb-16 md:pb-24">
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-end">
          <div className="md:col-span-4 flex flex-col gap-6">
            <Link
              href={home}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg transition-colors w-fit"
            >
              <span aria-hidden>←</span>
              <span>{dict.work.back}</span>
            </Link>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {spots.length > 0 ? `${copy.eyebrow} · ${spots.length}` : copy.eyebrow}
            </span>
          </div>
          <div className="md:col-span-8">
            <Reveal>
              <h1 className="font-serif italic text-[18vw] md:text-[12vw] leading-[0.85] tracking-tight">
                {copy.heading}
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-8 max-w-2xl text-fg/70 text-lg md:text-xl leading-snug">
                {copy.lead}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Cities. First because someone who already knows what a guest spot is
          came here for the list and the dates, not for the explanation.

          Guarded on length because every city can be retired at once with
          `enabled: false`, and an empty bordered box under a "Ciudades"
          heading reads as a page that failed to load rather than as a studio
          with no trips booked. The section below still invites a message. */}
      {spots.length > 0 ? (
        <section className="px-6 md:px-10 py-20 md:py-28 border-t border-line">
          <Reveal>
            <div className="flex items-baseline justify-between mb-10 md:mb-14 gap-4">
              <h2 className="font-serif italic text-3xl md:text-5xl">
                {copy.citiesTitle}
              </h2>
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted text-right">
                {copy.citiesEyebrow}
              </span>
            </div>
          </Reveal>

          <ol className="divide-y divide-line border-y border-line">
            {spots.map((spot, i) => (
              <Reveal key={spot.slug} delay={i * 60}>
                <li>
                  <Link
                    href={guestSpotCityPath(locale, spot.slug)}
                    className="group grid md:grid-cols-12 items-baseline gap-2 md:gap-8 py-8 md:py-10"
                  >
                    <span className="md:col-span-1 font-mono text-xs uppercase tracking-[0.2em] text-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="md:col-span-4 font-serif text-3xl md:text-4xl transition-opacity group-hover:opacity-60">
                      {spot.city[locale]}
                    </h3>
                    <span className="md:col-span-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">
                      {spot.country[locale]}
                    </span>
                    {/* The dates line is the highest-value thing on the row, so
                        it gets full contrast when it exists and the muted
                        "no dates" state when it does not — never a blank gap
                        that reads as a page still being built. */}
                    <span
                      className={`md:col-span-3 md:text-right font-mono text-xs uppercase tracking-[0.2em] ${
                        spot.nextDates ? "text-accent" : "text-muted"
                      }`}
                    >
                      {spot.nextDates ? (
                        <>
                          <span className="sr-only">{copy.datesLabel}: </span>
                          {spot.nextDates}
                        </>
                      ) : (
                        copy.noDates
                      )}
                      <span
                        aria-hidden
                        className="inline-block ml-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>
      ) : null}

      {/* How a guest spot works. */}
      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-line">
        <Reveal>
          <div className="flex items-baseline justify-between mb-12 md:mb-16 gap-4">
            <h2 className="font-serif italic text-3xl md:text-5xl">
              {copy.howTitle}
            </h2>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted text-right">
              {copy.howEyebrow}
            </span>
          </div>
        </Reveal>

        <ol className="divide-y divide-line border-y border-line">
          {copy.steps.map((step, i) => (
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

      {/* Cities that are not on the list, and how to reach me for either case. */}
      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-line">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {copy.elsewhereEyebrow}
          </span>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-8 font-serif text-4xl md:text-6xl leading-[0.95] max-w-3xl">
            {copy.elsewhereTitle}
          </h2>
          <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed text-fg/80">
            {copy.elsewhereBody}
          </p>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-12 grid md:grid-cols-2 gap-8 md:gap-12 max-w-3xl">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-2">
                {dict.contact.directLabel}
              </p>
              <a
                href={`mailto:${SITE_EMAIL}`}
                className="text-lg md:text-xl border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
              >
                {SITE_EMAIL}
              </a>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-2">
                {dict.contact.instagramLabel}
              </p>
              {/* The DM deep link rather than the profile, as in the booking
                  flow: this block exists to start a message, and making a
                  reader find the message button on a profile page loses some
                  of them on the way. */}
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
      </section>
    </SiteShell>
  );
}
