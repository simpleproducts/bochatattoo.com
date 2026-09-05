export type Ratio = "portrait" | "square" | "landscape" | "tall";

export type Dictionary = {
  meta: { title: string; description: string };
  nav: {
    work: string;
    about: string;
    process: string;
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
    /** Home section eyebrow + title */
    eyebrow: string;
    title: string;
    inquire: string;
    open: string;
    /** Max number of pieces shown on home */
    featuredLimit: number;
    /** Link from home Work section to the full archive */
    viewAll: string;
    /** Standalone /work page */
    pageTitle: string;
    intro: string;
    back: string;
    metaTitle: string;
    metaDescription: string;
    /** Empty-state copy for when the manifest has no images yet */
    emptyState: string;
    /** Lightbox UI labels */
    lightbox: {
      close: string;
      next: string;
      prev: string;
      share: string;
      /** Shown only on the home (featured) lightbox after the last piece */
      endTitle: string;
      endCopy: string;
      startOver: string;
      continueLabel: string;
    };
  };
  about: {
    eyebrow: string;
    headingPart1: string;
    headingPart2: string;
    intro1: string;
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
  faq: {
    eyebrow: string;
    title: string;
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
  };
  footer: { rights: string; backToTop: string };
  newsletter: {
    label: string;
    placeholder: string;
    submit: string;
    success: string;
    error: string;
  };
  localeSwitcher: { label: string };
  /**
   * Private-link client booking flow (/book/<token>). Every string here is
   * client-facing: nothing in this block is ever shown to the admin.
   */
  booking: {
    metaTitle: string;
    header: { home: string };
    card: { eyebrow: string; studioTime: string; deposit: string };
    /** The three steps of the flow, mirrored by the progress rail. */
    rail: { details: string; terms: string; receipt: string };
    form: {
      eyebrow: string;
      intro: string;
      name: string;
      email: string;
      emailHint: string;
      instagram: string;
      phone: string;
      note: string;
      optional: string;
      /** Marks a field the studio filled in before the link was sent. */
      prefilled: string;
      nameRequired: string;
      emailRequired: string;
      invalidEmail: string;
      invalidInstagram: string;
      invalidPhone: string;
      continue: string;
      sending: string;
      edit: string;
      savedSummary: string;
    };
    terms: {
      title: string;
      scrollHint: string;
      accept: string;
      /** Contains a literal {version}, replaced at render like footer.rights's {year}. */
      version: string;
      back: string;
      confirm: string;
    };
    payment: {
      eyebrow: string;
      intro: string;
      alias: string;
      cbu: string;
      holder: string;
      bank: string;
      amount: string;
      copy: string;
      copied: string;
    };
    receipt: {
      eyebrow: string;
      intro: string;
      drop: string;
      tap: string;
      formats: string;
      change: string;
      uploading: string;
      verifying: string;
      uploaded: string;
      replace: string;
      retry: string;
    };
    done: {
      eyebrow: string;
      title: string;
      body: string;
      sentTo: string;
      addToCalendar: string;
      /** Event summary written into the .ics file. */
      calendarTitle: string;
    };
    /** One panel, four variants — the page picks by why the link was refused. */
    invalid: {
      expired: string;
      revoked: string;
      cancelled: string;
      notFound: string;
      help: string;
      emailCta: string;
      instagramCta: string;
    };
    /** Client-facing labels for the derived status. "cancelled" never reaches this page. */
    status: { pending: string; awaitingReceipt: string; confirmed: string };
    /** Keyed by the camelCased API error code; `generic` covers anything unmapped. */
    errors: {
      generic: string;
      network: string;
      rateLimited: string;
      tooLarge: string;
      unsupportedType: string;
      invalidLink: string;
      linkExpired: string;
      bookingLocked: string;
      termsRequired: string;
      tooManyAttempts: string;
      conflict: string;
      missingContact: string;
    };
  };
};
