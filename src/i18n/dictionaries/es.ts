import type { Dictionary } from "../types";

const es: Dictionary = {
  meta: {
    title: "Bocha — Tatuador",
    description:
      "Bocha es tatuador y trabaja con turnos. Diseños originales, trabajo cuidado.",
  },
  nav: {
    work: "Obra",
    about: "Sobre mí",
    process: "Proceso",
    aftercare: "Cuidados",
    faq: "Preguntas",
    contact: "Contacto",
    book: "Reservar",
    menuOpen: "Abrir menú",
    menuClose: "Cerrar menú",
  },
  hero: {
    badge: "Desde 20XX — Placeholder",
    location: "Con turno / En cualquier parte",
    booking: "Tomando reservas",
    title1: "bocha",
    title2: "tattoo",
    intro:
      "Un estudio de tatuajes con base en el dibujo — placeholder que describe la práctica, la filosofía y la corriente que lleva cada pieza desde el boceto hasta la piel.",
    cta: "Ver la obra",
    scroll: "Scroll",
  },
  marquee: [
    "Diseños originales",
    "Con turno",
    "Flash a medida",
    "Walk-ins ocasionales",
    "Negro y gris",
    "Línea fina",
  ],
  work: {
    eyebrow: "01 / Obra",
    title: "Piezas seleccionadas",
    inquire: "Consultar por una pieza →",
    open: "Ver pieza",
    pieces: [
      { slug: "untitled-forearm", ratio: "portrait", title: "Sin título — Antebrazo" },
      { slug: "untitled-sternum", ratio: "tall", title: "Sin título — Esternón" },
      { slug: "untitled-hand", ratio: "square", title: "Sin título — Mano" },
      { slug: "untitled-calf", ratio: "portrait", title: "Sin título — Pantorrilla" },
      { slug: "untitled-back", ratio: "landscape", title: "Sin título — Espalda" },
      { slug: "untitled-thigh", ratio: "portrait", title: "Sin título — Muslo" },
      { slug: "untitled-ribs", ratio: "tall", title: "Sin título — Costillas" },
      { slug: "untitled-neck", ratio: "square", title: "Sin título — Cuello" },
      { slug: "untitled-shoulder", ratio: "portrait", title: "Sin título — Hombro" },
    ],
    lightbox: { close: "Cerrar", next: "Siguiente", prev: "Anterior" },
  },
  about: {
    eyebrow: "02 / Sobre mí",
    headingPart1: "Primero el dibujo.",
    headingPart2: "Después el tatuaje.",
    intro1:
      "Placeholder. Una descripción breve y honesta de quién es Bocha, dónde está el estudio, y cómo la práctica fue tomando forma con los años.",
    intro2:
      "Placeholder de la filosofía: cómo cada tatuaje surge de una conversación, qué tipo de trabajo distingue al estudio y qué piezas a Bocha le interesa construir.",
    portraitAlt: "Retrato — Bocha",
    meta: {
      based: ["Ubicación", "Placeholder"],
      style: ["Estilo", "Placeholder"],
      booking: ["Reservas", "Bajo pedido"],
      since: ["Desde", "20XX"],
    },
  },
  process: {
    eyebrow: "03 / Proceso",
    title: "Del boceto a la piel",
    steps: [
      { n: "01", title: "Consulta", body: "Mandá una nota corta con tu idea, referencias, ubicación y tamaño aproximado. Placeholder." },
      { n: "02", title: "Conversación", body: "Hablamos sobre la pieza — qué significa, cómo debería sentirse, dónde vive en el cuerpo. Placeholder." },
      { n: "03", title: "Diseño", body: "Bocha dibuja un diseño a medida del brief. Una ronda de ajustes antes del día. Placeholder." },
      { n: "04", title: "Sesión", body: "Nos encontramos en el estudio. Sesiones privadas, sin apuro, enfocadas en el trabajo. Placeholder." },
    ],
  },
  aftercare: {
    eyebrow: "04 / Cuidados",
    title: "Cuidá tu tatuaje",
    intro:
      "Placeholder. Las primeras dos semanas definen cómo se asienta la pieza — limpiá con suavidad, mantené cubierto cuando haga falta y dejá que la piel haga su trabajo.",
    steps: [
      { n: "Día 1", title: "Mantenelo cubierto", body: "Dejá el film puesto el tiempo que indique Bocha (generalmente 2–24 horas). Placeholder." },
      { n: "Días 2–4", title: "Lavá y humectá", body: "Lavado suave con jabón sin perfume, secá con palmaditas, fina capa de humectante 2–3 veces por día. Placeholder." },
      { n: "Días 5–14", title: "No te lo arranques", body: "Va a descamarse y picar. No rasques, no peles. Si pica, tocalo con palmadita. Placeholder." },
      { n: "Siempre", title: "Sol y mar", body: "FPS 50+ una vez cicatrizado. Evitá pileta, jacuzzi y sol directo el primer mes. Placeholder." },
    ],
  },
  faq: {
    eyebrow: "05 / Preguntas",
    title: "Preguntas frecuentes",
    items: [
      { q: "¿Cómo reservo una sesión?", a: "Placeholder. Mail, DM de Instagram o WhatsApp — el que prefieras. Una seña reserva la fecha." },
      { q: "¿Hacés diseños a medida?", a: "Placeholder. Sí — la mayoría del trabajo es a medida. Mandá referencias, ubicación y tamaño aproximado para arrancar." },
      { q: "¿Cuánto cuesta?", a: "Placeholder. El precio depende del tamaño, ubicación y complejidad. Vas a tener un estimado antes de reservar." },
      { q: "¿Cuál es tu estilo?", a: "Placeholder. Principalmente negro y gris, línea fina y trabajo ilustrativo cuidado — pero cada pieza se construye alrededor de quien la lleva." },
      { q: "¿Tatuás a personas que se hacen el primero?", a: "Placeholder. Siempre bienvenidas. Bocha te explica todo antes de que la aguja toque la piel." },
      { q: "¿Puedo venir con alguien?", a: "Placeholder. Una persona como acompañante está bien — el estudio es un espacio tranquilo y enfocado." },
    ],
  },
  contact: {
    eyebrow: "06 / Contacto",
    status: "Tomando reservas",
    title1: "Hacete un",
    title2: "tatuaje.",
    directLabel: "Directo",
    instagramLabel: "Instagram",
    bookingLabel: "Reservas",
    bookingCta: "WhatsApp →",
  },
  footer: {
    rights: "© {year} — Bocha",
  },
  localeSwitcher: {
    label: "Idioma",
  },
};

export default es;
