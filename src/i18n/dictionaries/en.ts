import type { Dictionary } from "../types";

const en: Dictionary = {
  meta: {
    title: "Bocha — Tattoo Artist",
    description:
      "Bocha is a tattoo artist working by appointment. Original designs, considered work.",
  },
  nav: {
    work: "Work",
    about: "About",
    process: "Process",
    aftercare: "Aftercare",
    faq: "FAQ",
    contact: "Contact",
    book: "Book",
    menuOpen: "Open menu",
    menuClose: "Close menu",
  },
  hero: {
    badge: "Est. 20XX — Placeholder",
    location: "By appointment / Worldwide",
    booking: "Now booking",
    title1: "bocha",
    title2: "tattoo",
    intro:
      "A tattoo studio rooted in considered drawing — placeholder copy describing the practice, the philosophy, and the wave that carries each piece from sketch to skin.",
    cta: "View the work",
    scroll: "Scroll",
  },
  marquee: [
    "Original designs",
    "By appointment",
    "Custom flash",
    "Walk-ins occasional",
    "Black & grey",
    "Fine line",
  ],
  work: {
    eyebrow: "01 / Work",
    title: "Selected pieces",
    inquire: "Inquire about a piece →",
    open: "Open piece",
    pieces: [
      { slug: "untitled-forearm", ratio: "portrait", title: "Untitled — Forearm" },
      { slug: "untitled-sternum", ratio: "tall", title: "Untitled — Sternum" },
      { slug: "untitled-hand", ratio: "square", title: "Untitled — Hand" },
      { slug: "untitled-calf", ratio: "portrait", title: "Untitled — Calf" },
      { slug: "untitled-back", ratio: "landscape", title: "Untitled — Back" },
      { slug: "untitled-thigh", ratio: "portrait", title: "Untitled — Thigh" },
      { slug: "untitled-ribs", ratio: "tall", title: "Untitled — Ribs" },
      { slug: "untitled-neck", ratio: "square", title: "Untitled — Neck" },
      { slug: "untitled-shoulder", ratio: "portrait", title: "Untitled — Shoulder" },
    ],
    lightbox: { close: "Close", next: "Next", prev: "Previous" },
  },
  about: {
    eyebrow: "02 / About",
    headingPart1: "Drawing first.",
    headingPart2: "Tattooing second.",
    intro1:
      "Placeholder bio paragraph. A short, honest description of who Bocha is, where the studio sits, and how the practice took shape over the years.",
    intro2:
      "Placeholder for the philosophy: how each tattoo emerges from a conversation, what kind of work the studio is most known for, and the kinds of pieces Bocha is drawn to building.",
    portraitAlt: "Portrait — Bocha",
    meta: {
      based: ["Based", "Placeholder"],
      style: ["Style", "Placeholder"],
      booking: ["Booking", "By request"],
      since: ["Since", "20XX"],
    },
  },
  process: {
    eyebrow: "03 / Process",
    title: "From sketch to skin",
    steps: [
      { n: "01", title: "Inquiry", body: "Send a short note with your idea, references, placement, and approximate size. Placeholder copy describing the intake." },
      { n: "02", title: "Conversation", body: "We discuss the piece — what it means, how it should feel, where it lives on the body. Placeholder copy." },
      { n: "03", title: "Design", body: "Bocha drafts a custom design from the brief. One round of refinements before the day. Placeholder copy." },
      { n: "04", title: "Session", body: "We meet at the studio. Sessions are private, unhurried, and focused on the work. Placeholder copy." },
    ],
  },
  aftercare: {
    eyebrow: "04 / Aftercare",
    title: "Care for your tattoo",
    intro:
      "Placeholder intro. The first two weeks shape how the piece settles — clean it gently, keep it covered when needed, and let your skin do the work.",
    steps: [
      { n: "Day 1", title: "Keep it wrapped", body: "Leave the bandage on for the time Bocha tells you (usually 2–24 hours). Placeholder copy." },
      { n: "Days 2–4", title: "Wash & moisturize", body: "Gentle wash with fragrance-free soap, pat dry, thin layer of moisturizer 2–3 times a day. Placeholder copy." },
      { n: "Days 5–14", title: "Don't pick", body: "It will flake and itch. Don't scratch, don't peel. Tap if it itches. Placeholder copy." },
      { n: "Forever", title: "Sun & sea", body: "SPF 50+ once healed. Avoid pools, hot tubs and direct sun for the first month. Placeholder copy." },
    ],
  },
  faq: {
    eyebrow: "05 / FAQ",
    title: "Common questions",
    items: [
      { q: "How do I book a session?", a: "Placeholder answer. Email, Instagram DM, or WhatsApp — whichever you prefer. A small deposit holds the date." },
      { q: "Do you take custom designs?", a: "Placeholder answer. Yes — most work is custom. Send references, placement, and rough size to start the conversation." },
      { q: "How much does it cost?", a: "Placeholder answer. Pricing depends on size, placement, and complexity. You'll get an estimate before booking." },
      { q: "What's your style?", a: "Placeholder answer. Predominantly black and grey, fine line, and considered illustrative work — but each piece is built around the wearer." },
      { q: "Do you tattoo first-timers?", a: "Placeholder answer. Always welcome. Bocha will walk you through everything before the needle touches skin." },
      { q: "Can I bring a friend?", a: "Placeholder answer. One guest is fine for support — the studio is a calm, focused space." },
    ],
  },
  contact: {
    eyebrow: "06 / Contact",
    status: "Currently booking",
    title1: "Get a",
    title2: "tattoo.",
    directLabel: "Direct",
    instagramLabel: "Instagram",
    bookingLabel: "Booking",
    bookingCta: "WhatsApp →",
  },
  footer: {
    rights: "© {year} — Bocha",
  },
  localeSwitcher: {
    label: "Language",
  },
};

export default en;
