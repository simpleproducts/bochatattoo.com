import type { Dictionary } from "../types";

const en: Dictionary = {
  meta: {
    title: "Bocha · Tattoo Artist · Almagro, Buenos Aires",
    description:
      "Bocha — tattoo artist working out of Almagro, Buenos Aires since 2011. Considered, custom work by appointment. Guest spots in Berlin and Madrid.",
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
    location: "Almagro, Buenos Aires",
    booking: "Now booking",
    title1: "bocha",
    title2: "tattoo",
    intro:
      "Tattoo artist working out of a quiet studio in Almagro, Buenos Aires since 2011. Considered, custom drawings — one client at a time, no rush.",
    cta: "View the work",
    scroll: "Scroll",
  },
  marquee: [
    "Custom designs",
    "By appointment",
    "Almagro · Buenos Aires",
    "Since 2011",
    "Guest spots · Berlin · Madrid",
    "Mostly black",
  ],
  work: {
    eyebrow: "01 / Work",
    title: "Selected work",
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
      "I'm Bocha. I've been tattooing since 2011, working out of a quiet, private studio in Almagro, Ciudad de Buenos Aires. Each piece starts on paper — sometimes for weeks before it touches skin.",
    intro2:
      "I work mostly in black, mostly small. One client at a time, no overlap, no rush. A few times a year I take the work on the road — guest spots in Berlin, Madrid, and other cities I'm fond of.",
    portraitAlt: "Portrait — Bocha",
    meta: {
      based: ["Based", "Almagro · BA"],
      style: ["Style", "Mostly black"],
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
        body: "Send a short note with your idea, references, placement, and approximate size. The more honest the better — there's no perfect template.",
      },
      {
        n: "02",
        title: "Conversation",
        body: "We talk it through. What it means, how it should feel, where it lives on the body. Sometimes that's one message, sometimes a few.",
      },
      {
        n: "03",
        title: "Design",
        body: "I draft the piece from your brief. You see it before the day, and we have one round of changes if anything needs adjusting.",
      },
      {
        n: "04",
        title: "Session",
        body: "We meet at the studio in Almagro. The room is quiet, sessions are private, and there's no rush to finish. Coffee or mate is on me.",
      },
    ],
  },
  aftercare: {
    eyebrow: "04 / Aftercare",
    title: "Care for your tattoo",
    intro:
      "The first two weeks shape how your tattoo settles. Most of the work is gentle — keep it clean, keep it covered when needed, and let your skin do the rest.",
    steps: [
      {
        n: "Day 1",
        title: "Keep it wrapped",
        body: "Leave the bandage on for the time we agreed (usually between 2 and 24 hours). Once you take it off, wash gently with warm water and unscented soap, pat dry with a clean towel.",
      },
      {
        n: "Days 2–4",
        title: "Wash and moisturize",
        body: "Wash twice a day with unscented soap, pat dry, and apply a thin layer of fragrance-free moisturizer. Less is more — over-moisturizing slows healing.",
      },
      {
        n: "Days 5–14",
        title: "Don't pick",
        body: "Your tattoo will flake and itch. Don't scratch, don't peel — tap it if you need to. The flakes carry colour out if you pull them.",
      },
      {
        n: "Forever",
        title: "Sun and water",
        body: "Once fully healed, SPF 50+ whenever it sees direct sun. For the first month, avoid pools, the ocean, hot tubs, and long sun exposure.",
      },
    ],
  },
  faq: {
    eyebrow: "05 / FAQ",
    title: "Common questions",
    items: [
      {
        q: "How do I book a session with you?",
        a: "Reach out on Instagram with a short message: your idea, placement, approximate size, and any references. I check messages once a day. If we're a fit I'll send dates and a deposit link. I post current availability in my Instagram stories.",
      },
      {
        q: "Do you take custom designs?",
        a: "Almost everything I do is custom. Send references for inspiration — I won't copy another artist's work, but I'll build a piece that feels like it belongs to you.",
      },
      {
        q: "How much does a tattoo cost?",
        a: "Pricing is quoted per project, based on size, placement, complexity, and how long it'll take. You'll get a clear quote before booking — no surprises on the day.",
      },
      {
        q: "Where is the studio?",
        a: "Almagro, in the City of Buenos Aires. I'll send the exact address once your appointment is confirmed. The studio is private, calm, and easy to reach by Subte.",
      },
      {
        q: "Do you tattoo first-timers?",
        a: "All the time. I'll walk you through the whole thing before we start — what to expect, how it'll feel, what to do after. Eat something beforehand, sleep well, and we'll be fine.",
      },
      {
        q: "Do you travel for guest spots?",
        a: "Yes — a few times a year I work from studios in Berlin, Madrid, and other cities. Dates are announced on Instagram a couple of months ahead; bookings open the same way as in Buenos Aires.",
      },
      {
        q: "What's your style?",
        a: "Mostly black. Mostly small. Considered drawing — pieces that hold up close and from across the room. The work speaks better than a label.",
      },
      {
        q: "What's the deposit?",
        a: "A small deposit holds your date and goes toward the final price. Details are sent with your booking confirmation. Deposits are non-refundable but can be moved once with at least 48 hours' notice.",
      },
    ],
  },
  contact: {
    eyebrow: "06 / Contact",
    status: "Booking from Instagram",
    title1: "Get a",
    title2: "tattoo.",
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
