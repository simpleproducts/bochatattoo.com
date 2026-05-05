import type { Dictionary } from "../types";

const en: Dictionary = {
  meta: {
    title: "Bocha · Tattoo Artist · Almagro, Buenos Aires",
    description:
      "Tattoos in black, made slowly. Solo studio in Almagro, Buenos Aires. Working since 2011. Guest spots in Berlin and Madrid.",
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
    badge: "Est. 2011 — Almagro BA",
    location: "Almagro · Buenos Aires",
    booking: "Now booking",
    title1: "bocha",
    title2: "tattoo",
    intro:
      "Tattoos in black, made slowly. Solo studio in Almagro, Buenos Aires. Working since 2011.",
    cta: "View the work",
    scroll: "Scroll",
  },
  marquee: [
    "Tattoos in black",
    "By appointment",
    "Almagro · Buenos Aires",
    "Solo studio",
    "Since 2011",
    "Berlin · Madrid",
  ],
  work: {
    eyebrow: "01 / Work",
    title: "Selected work",
    inquire: "Ask about a piece →",
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
      "I'm Bocha. Born and based in Buenos Aires. Tattooing since 2011 from a small studio in Almagro — quiet by design.",
    intro2:
      "I work in black, mostly small, mostly slow. One person in the studio at a time. A few weeks a year I take the work to Berlin and Madrid.",
    portraitAlt: "Portrait — Bocha",
    meta: {
      based: ["Based", "Almagro · BA"],
      style: ["Style", "Black, mostly small"],
      booking: ["Booking", "By appointment"],
      since: ["Since", "2011"],
    },
  },
  process: {
    eyebrow: "03 / Process",
    title: "From sketch to skin",
    steps: [
      {
        n: "01",
        title: "Inquiry",
        body: "Send the idea, references, placement, and rough size. A paragraph is plenty. I read everything.",
      },
      {
        n: "02",
        title: "Conversation",
        body: "We trade a few messages. The piece gets clearer with each one — what it means, where it sits, how big it should feel.",
      },
      {
        n: "03",
        title: "Design",
        body: "I draw it from your brief. You see it before the day. One round of changes if it needs them.",
      },
      {
        n: "04",
        title: "Session",
        body: "Studio in Almagro. Private room, one client a day, no overlap. We start when you're ready.",
      },
    ],
  },
  aftercare: {
    eyebrow: "04 / Aftercare",
    title: "Care for your tattoo",
    intro:
      "The first two weeks decide how the tattoo settles. Be gentle, stay patient, and your skin does the rest.",
    steps: [
      {
        n: "Day 1",
        title: "Keep it wrapped",
        body: "Leave the bandage on for the time we agreed (2 to 24 hours). Once off: warm water, unscented soap, pat dry with a clean towel.",
      },
      {
        n: "Days 2–4",
        title: "Wash and moisturize",
        body: "Twice a day. Unscented soap, thin layer of fragrance-free cream. Less is more — too much slows healing.",
      },
      {
        n: "Days 5–14",
        title: "Don't pick",
        body: "It will flake and itch. Don't scratch, don't peel. Tap if it's bad. The flakes carry color out if you pull them.",
      },
      {
        n: "Forever",
        title: "Sun and water",
        body: "SPF 50+ for life. First month: no pool, no sea, no sauna, no hours of sun.",
      },
    ],
  },
  faq: {
    eyebrow: "05 / FAQ",
    title: "Common questions",
    items: [
      {
        q: "How do I book?",
        a: "Instagram DM. A few sentences: idea, placement, rough size, references. I check messages once a day. If it's a fit, I send dates and a deposit link. Open availability lives in my Instagram stories.",
      },
      {
        q: "Do you take custom designs?",
        a: "Almost everything I do is custom. Send references for direction — I won't copy another artist's work, but I'll build something that's only yours.",
      },
      {
        q: "How much does it cost?",
        a: "Quoted per project. I weigh size, placement, complexity, and time. You get the number before you commit — never on the day.",
      },
      {
        q: "Where's the studio?",
        a: "Almagro, Ciudad de Buenos Aires. Private space, easy on the Subte. The exact address goes out with your booking confirmation.",
      },
      {
        q: "First tattoo. Should I be worried?",
        a: "No. We talk through everything before we start — what to expect, what it'll feel like, what to do after. Eat well, sleep enough, show up. The rest is on me.",
      },
      {
        q: "Do you travel?",
        a: "Yes — Berlin and Madrid most years, plus the occasional one-off. Dates land on Instagram a couple of months ahead. Same booking flow as Buenos Aires.",
      },
      {
        q: "What's your style?",
        a: "Mostly black. Mostly small. Drawing-first work — pieces that hold up close, and from across the room. The portfolio says it better than any label.",
      },
      {
        q: "What's the deposit?",
        a: "A small, non-refundable hold against your final price. Details come with the confirmation. Movable once if you give me 48 hours.",
      },
    ],
  },
  contact: {
    eyebrow: "06 / Contact",
    status: "Booking via Instagram",
    title1: "Make a",
    title2: "piece.",
    directLabel: "Email",
    instagramLabel: "Instagram (preferred)",
    bookingLabel: "WhatsApp",
    bookingCta: "WhatsApp →",
  },
  footer: {
    rights: "© {year} — Bocha · Almagro, Buenos Aires",
  },
  localeSwitcher: {
    label: "Language",
  },
};

export default en;
