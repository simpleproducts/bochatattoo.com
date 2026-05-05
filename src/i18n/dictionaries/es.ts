import type { Dictionary } from "../types";

const es: Dictionary = {
  meta: {
    title: "Bocha · Tatuador · Almagro, Buenos Aires",
    description:
      "Bocha — tatuador en Almagro, Ciudad de Buenos Aires, desde 2011. Trabajo a medida, con turno. Tours por Berlín y Madrid.",
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
    badge: "Desde 2011 — Almagro BA",
    location: "Almagro, Buenos Aires",
    booking: "Tomando reservas",
    title1: "bocha",
    title2: "tattoo",
    intro:
      "Tatuador trabajando desde un estudio tranquilo en Almagro, Ciudad de Buenos Aires, desde 2011. Dibujos a medida, cuidados — un cliente por vez, sin apuro.",
    cta: "Ver la obra",
    scroll: "Scroll",
  },
  marquee: [
    "Diseños a medida",
    "Con turno",
    "Almagro · Buenos Aires",
    "Desde 2011",
    "Tours · Berlín · Madrid",
    "Casi siempre negro",
  ],
  work: {
    eyebrow: "01 / Obra",
    title: "Trabajos seleccionados",
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
      "Soy Bocha. Tatúo desde 2011, en un estudio tranquilo y privado en Almagro, Ciudad de Buenos Aires. Cada pieza arranca en papel — a veces durante semanas antes de tocar la piel.",
    intro2:
      "Trabajo casi siempre en negro, casi siempre chico. Un cliente por vez, sin superposición, sin apuro. Un par de veces al año me llevo el trabajo de viaje — tours por Berlín, Madrid y otras ciudades que me gustan.",
    portraitAlt: "Retrato — Bocha",
    meta: {
      based: ["Ubicación", "Almagro · CABA"],
      style: ["Estilo", "Casi siempre negro"],
      booking: ["Reservas", "Con turno"],
      since: ["Desde", "2011"],
    },
  },
  process: {
    eyebrow: "03 / Proceso",
    title: "Del boceto a la piel",
    steps: [
      {
        n: "01",
        title: "Consulta",
        body: "Mandame una nota corta con tu idea, referencias, ubicación y tamaño aproximado. Cuanto más honesto, mejor — no hay un formato perfecto.",
      },
      {
        n: "02",
        title: "Conversación",
        body: "Lo charlamos. Qué significa, cómo debería sentirse, dónde vive en el cuerpo. A veces es un solo mensaje, a veces varios.",
      },
      {
        n: "03",
        title: "Diseño",
        body: "Dibujo la pieza desde tu brief. La ves antes del día, y tenemos una ronda de cambios si hay algo para ajustar.",
      },
      {
        n: "04",
        title: "Sesión",
        body: "Nos vemos en el estudio en Almagro. La sala es tranquila, las sesiones son privadas, y no hay apuro por terminar. El café o el mate los pongo yo.",
      },
    ],
  },
  aftercare: {
    eyebrow: "04 / Cuidados",
    title: "Cuidá tu tatuaje",
    intro:
      "Las primeras dos semanas definen cómo se asienta el tatuaje. La mayor parte del trabajo es suave — mantenelo limpio, cubierto cuando haga falta, y dejá que la piel haga el resto.",
    steps: [
      {
        n: "Día 1",
        title: "Mantenelo cubierto",
        body: "Dejá el film puesto el tiempo que acordamos (en general entre 2 y 24 horas). Cuando lo saques, lavá con agua tibia y jabón sin perfume, secá con palmaditas y una toalla limpia.",
      },
      {
        n: "Días 2–4",
        title: "Lavá y humectá",
        body: "Lavá dos veces por día con jabón sin perfume, secá con palmaditas, y aplicá una capa fina de humectante sin fragancia. Menos es más — humectar de más demora la cicatrización.",
      },
      {
        n: "Días 5–14",
        title: "No te lo arranques",
        body: "Va a descamarse y picar. No rasques, no peles — tocalo con palmaditas si necesitás. Las costritas se llevan tinta si las arrancás.",
      },
      {
        n: "Siempre",
        title: "Sol y agua",
        body: "Una vez cicatrizado, FPS 50+ cada vez que le toque sol directo. El primer mes, evitá pileta, mar, jacuzzi y exposición prolongada al sol.",
      },
    ],
  },
  faq: {
    eyebrow: "05 / Preguntas",
    title: "Preguntas frecuentes",
    items: [
      {
        q: "¿Cómo reservo una sesión?",
        a: "Escribime por Instagram con un mensaje corto: tu idea, ubicación, tamaño aproximado y referencias si tenés. Reviso mensajes una vez por día. Si pinta, te paso fechas y un link de seña. La disponibilidad actual la subo en mis historias de Instagram.",
      },
      {
        q: "¿Hacés diseños a medida?",
        a: "Casi todo lo que hago es a medida. Mandame referencias para inspiración — no copio el trabajo de otro tatuador, pero te dibujo una pieza que se sienta tuya.",
      },
      {
        q: "¿Cuánto cuesta un tatuaje?",
        a: "El precio es por proyecto, según tamaño, ubicación, complejidad y duración. Vas a tener un presupuesto claro antes de reservar — sin sorpresas el día del turno.",
      },
      {
        q: "¿Dónde queda el estudio?",
        a: "En Almagro, Ciudad de Buenos Aires. La dirección exacta te la mando cuando tu turno está confirmado. Es un espacio privado, tranquilo y fácil de llegar en Subte.",
      },
      {
        q: "¿Tatuás a personas que se hacen el primero?",
        a: "Todo el tiempo. Te explico todo antes de arrancar — qué esperar, cómo se siente, qué hacer después. Comé algo antes, dormí bien, y va a salir bien.",
      },
      {
        q: "¿Viajás para tours o guest spots?",
        a: "Sí — un par de veces por año trabajo desde estudios en Berlín, Madrid y otras ciudades. Las fechas las anuncio por Instagram con un par de meses de anticipación; las reservas se manejan igual que en Buenos Aires.",
      },
      {
        q: "¿Cuál es tu estilo?",
        a: "Casi siempre negro. Casi siempre chico. Dibujo cuidado — piezas que funcionan de cerca y de lejos. El trabajo habla mejor que cualquier etiqueta.",
      },
      {
        q: "¿Cómo es la seña?",
        a: "Una seña chica reserva tu fecha y se descuenta del precio final. Los detalles los mando con la confirmación. Las señas no se devuelven, pero se pueden mover una vez si me avisás con al menos 48 horas de anticipación.",
      },
    ],
  },
  contact: {
    eyebrow: "06 / Contacto",
    status: "Reservas por Instagram",
    title1: "Hacete un",
    title2: "tatuaje.",
    directLabel: "Email",
    instagramLabel: "Instagram (preferido)",
    bookingLabel: "WhatsApp",
    bookingCta: "WhatsApp →",
  },
  footer: {
    rights: "© {year} — Bocha · Almagro, Buenos Aires",
  },
  localeSwitcher: {
    label: "Idioma",
  },
};

export default es;
