export type Ratio = "portrait" | "square" | "landscape" | "tall";

export type Dictionary = {
  meta: { title: string; description: string };
  nav: {
    work: string;
    about: string;
    process: string;
    aftercare: string;
    faq: string;
    contact: string;
    book: string;
    menuOpen: string;
    menuClose: string;
  };
  hero: {
    badge: string;
    location: string;
    booking: string;
    title1: string;
    title2: string;
    intro: string;
    cta: string;
    scroll: string;
  };
  marquee: string[];
  work: {
    eyebrow: string;
    title: string;
    inquire: string;
    open: string;
    pieces: { slug: string; ratio: Ratio; title: string }[];
    lightbox: { close: string; next: string; prev: string };
  };
  about: {
    eyebrow: string;
    headingPart1: string;
    headingPart2: string;
    intro1: string;
    intro2: string;
    portraitAlt: string;
    meta: {
      based: [string, string];
      style: [string, string];
      booking: [string, string];
      since: [string, string];
    };
  };
  process: {
    eyebrow: string;
    title: string;
    steps: { n: string; title: string; body: string }[];
  };
  aftercare: {
    eyebrow: string;
    title: string;
    intro: string;
    steps: { n: string; title: string; body: string }[];
  };
  faq: {
    eyebrow: string;
    title: string;
    /** Heading shown on the standalone /faq page (can use \n for line break) */
    pageTitle: string;
    intro: string;
    back: string;
    contactPrompt: string;
    contactCta: string;
    metaTitle: string;
    metaDescription: string;
    items: { q: string; a: string }[];
  };
  contact: {
    eyebrow: string;
    status: string;
    title1: string;
    title2: string;
    directLabel: string;
    instagramLabel: string;
    bookingLabel: string;
    bookingCta: string;
  };
  footer: { rights: string };
  localeSwitcher: { label: string };
};
