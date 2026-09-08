/**
 * The cities Bocha travels to for guest spots.
 *
 * This file is the single source of truth for the guest-spot hub, the city
 * pages, the sitemap and the areaServed in the LocalBusiness JSON-LD. It is
 * meant to be edited by the studio, not only by a developer: adding a city is
 * one object, retiring one is a single `false`.
 *
 * WHAT MAY BE WRITTEN HERE
 * Only what is true. There is no host studio, no date, no "every spring", no
 * "twice a year" in this file, because nobody has confirmed any of that. The
 * seeded intros say what is actually established — Bocha travels to these
 * cities for guest spots, and this is how you arrange a session — and nothing
 * more. A fabricated date or a studio name that never hosted him is a lie on a
 * real business's site and, when someone shows up on the strength of it, an
 * expensive one.
 *
 * `nextDates` IS THE HIGHEST-VALUE FIELD ON THE PAGE.
 * Everything else on a city page explains how the process works; this is the
 * one line that turns a search into a message. "Berlín, 12–20 de marzo" gives
 * a reader a deadline and a reason to write today, while an undated page only
 * invites them to bookmark it and forget. So: the moment a trip is booked,
 * fill it in — free text, in that language's own convention — and clear it
 * back to "" the moment the trip is over, because a stale date that has
 * already passed reads as an abandoned site and does more damage than an empty
 * field. While it is empty it is simply not rendered; the page still works.
 *
 * `enabled: false` REMOVES A CITY IN ONE MOVE.
 * It drops out of the hub, its own page stops being generated, and it
 * disappears from the sitemap — all three together, which is the point: the
 * alternative is a page that quietly rots in the index, gets crawled forever
 * and tells people Bocha visits somewhere he no longer goes. That is what to
 * do for a city he stops visiting. Keep the object rather than deleting it, so
 * the copy is still there if the trip comes back.
 *
 * Array order is display order on the hub.
 */
export type GuestSpot = {
  /** URL segment, shared by both languages: /guest-spots/berlin and /en/guest-spots/berlin. */
  slug: string;
  city: { es: string; en: string };
  country: { es: string; en: string };
  /** Rendered only when non-empty. Never invent one. */
  nextDates: string;
  intro: { es: string; en: string };
  /** false keeps it out of the pages AND the sitemap. */
  enabled: boolean;
};

/**
 * The six cities the site's own JSON-LD has been claiming as areaServed. They
 * are seeded here so that every claim finally has a page behind it.
 */
export const GUEST_SPOTS: GuestSpot[] = [
  {
    slug: "berlin",
    city: { es: "Berlín", en: "Berlin" },
    country: { es: "Alemania", en: "Germany" },
    nextDates: "",
    intro: {
      es: "En Berlín el tatuaje es parte del paisaje: hay estudios en casi cada barrio y la gente suele escribir con la idea ya bastante madura. Cuando viajo de guest spot hago exactamente lo mismo que en Almagro —microrealismo ilustrativo y fineline—, con el diseño cerrado antes de subirme al avión, porque un viaje no deja margen para empezar de cero. Escribime con tu idea, la zona del cuerpo y el tamaño aproximado, y lo vamos armando con tiempo.",
      en: "Berlin has one of the densest tattoo scenes in Europe, and people there tend to write with the idea already worked out. On a guest spot I do exactly what I do in Almagro — illustrative microrealism and fineline — with the design finished before the flight, because a trip leaves no room to start from scratch. Send me the idea, the placement and a rough size, and we'll have it drawn by the time I land.",
    },
    enabled: true,
  },
  {
    slug: "madrid",
    city: { es: "Madrid", en: "Madrid" },
    country: { es: "España", en: "Spain" },
    nextDates: "",
    intro: {
      es: "Madrid es la parada donde menos se pierde en la traducción: hablamos el mismo idioma, así que las referencias, el tamaño y la ubicación se resuelven en un par de mensajes y no en una semana de idas y vueltas. Un viaje son unos pocos días, no un año entero de estudio, así que la agenda se llena por orden de llegada. Mandame tu idea con referencias y te digo si entra.",
      en: "Madrid is the stop with the least friction: Spanish is my first language, so references, sizing and placement get settled in a couple of messages instead of a week of back and forth. A trip is a handful of days, not a whole year in the studio, so the days fill in the order people write. Send the idea with references and I'll tell you whether it fits.",
    },
    enabled: true,
  },
  {
    slug: "barcelona",
    city: { es: "Barcelona", en: "Barcelona" },
    country: { es: "España", en: "Spain" },
    nextDates: "",
    intro: {
      es: "Barcelona recibe tatuadores de todo el mundo y eso se nota: la gente compara mucho antes de elegir y llega con carpetas de referencia bien armadas. A mí me sirve, porque cuanto más claro está el punto de partida, más rápido cierro un diseño a distancia. Contame qué te querés tatuar, dónde y con qué tamaño, y te digo si lo puedo hacer en los días que esté ahí.",
      en: "Barcelona sees guest artists from everywhere, and it shows: people compare a lot of portfolios before choosing and turn up with a proper reference folder. That helps me, because the clearer the starting point, the faster a design gets closed over messages before the trip. Tell me what you want tattooed, where and at what size, and I'll tell you whether it fits the days I'm there.",
    },
    enabled: true,
  },
  {
    slug: "cologne",
    city: { es: "Colonia", en: "Cologne" },
    country: { es: "Alemania", en: "Germany" },
    nextDates: "",
    intro: {
      es: "Colonia está a media hora de tren de Düsseldorf y de Bonn, así que buena parte de las consultas vienen de gente que no vive en la ciudad y viajaría en el día. Si es tu caso, avisame cuando escribas: prefiero darte un turno temprano y con margen alrededor antes que hacerte hacer el viaje dos veces. El diseño lo cerramos por mensaje antes de que llegue, como siempre.",
      en: "Cologne sits about half an hour by train from Düsseldorf and Bonn, so a good share of the messages come from people who'd travel in for the day. If that's you, say so when you write: I'd rather give you an early slot with room around it than have you make the trip twice. As always, the design is settled by message before I fly.",
    },
    enabled: true,
  },
  {
    slug: "freiburg",
    city: { es: "Friburgo", en: "Freiburg" },
    country: { es: "Alemania", en: "Germany" },
    nextDates: "",
    intro: {
      es: "Friburgo es una ciudad chica al borde de la Selva Negra y a menos de una hora de Basilea, así que las consultas suelen llegar de los dos lados de la frontera. Se presta para piezas de sesión larga: hay menos ruido alrededor que en una capital, y el detalle fino agradece una sala tranquila. Escribime con la idea y las referencias; si el proyecto necesita más de una sesión, lo hablamos antes del viaje y no el mismo día.",
      en: "Freiburg is a small city on the edge of the Black Forest, under an hour from Basel, so enquiries usually come from both sides of the border. It suits longer sittings: there's less going on around a session than in a capital, and fine detail likes a quiet room. Write with the idea and references — if the piece needs more than one sitting, we plan that before the trip rather than on the day.",
    },
    enabled: true,
  },
  {
    slug: "basel",
    city: { es: "Basilea", en: "Basel" },
    country: { es: "Suiza", en: "Switzerland" },
    nextDates: "",
    intro: {
      es: "Basilea está en la esquina donde se tocan Suiza, Alemania y Francia, y el tranvía cruza la frontera, así que es el punto más cómodo de alcanzar desde tres países. Son días cortos y agendas apretadas: prefiero tener el diseño hablado y el presupuesto acordado por mensaje antes de llegar, en vez de gastar la sesión decidiendo. Contame tu idea, la zona y el tamaño, y te paso un presupuesto para ese proyecto.",
      en: "Basel sits on the corner where Switzerland, Germany and France meet, and the tram crosses the border, which makes it the easiest of these stops to reach from three countries. The days are short and calendars are tight, so I'd rather have the design talked through and the quote agreed by message before I arrive than spend the session deciding. Send the idea, the placement and the size, and I'll come back with a quote for that piece.",
    },
    enabled: true,
  },
];

/**
 * The only list the pages, the sitemap and the JSON-LD should ever read.
 * Reading GUEST_SPOTS directly would resurrect a retired city in whichever
 * place forgot to filter — one flag, one list, no drift.
 */
export const ENABLED_GUEST_SPOTS: GuestSpot[] = GUEST_SPOTS.filter(
  (spot) => spot.enabled,
);
