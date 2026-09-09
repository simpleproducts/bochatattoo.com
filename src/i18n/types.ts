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
    /**
     * The appointment's own zone is the primary clock on this card: a Berlin
     * session reads 14:00 Berlin to everyone who opens the link, wherever they
     * are. `appointmentTime` captions that line. `yourTime` captions the
     * reader's own clock underneath it, and is rendered only when the two
     * zones disagree — to a client sitting in the same zone it would just say
     * the same thing twice.
     */
    card: {
      eyebrow: string;
      appointmentTime: string;
      yourTime: string;
      deposit: string;
    };
    /**
     * The three steps of the flow, mirrored by the progress rail. The third
     * one has two names: `receipt` while a bank transfer is the way this
     * booking is being paid, `payment` while the client still has a choice to
     * make or has chosen MercadoPago — that path never produces a receipt, so
     * labelling the step after one would promise a screen it will not reach.
     */
    rail: { details: string; terms: string; receipt: string; payment: string };
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
      /**
       * `eyebrow` and `intro` head the bank-transfer details specifically, and
       * still do — everything above `chooseTitle` is the transfer path, which
       * this feature did not change.
       */
      eyebrow: string;
      intro: string;
      alias: string;
      cbu: string;
      holder: string;
      bank: string;
      amount: string;
      /**
       * The copy-button pair, shared with the confirmed panel's address block:
       * it is the same control doing the same thing, and a second identical
       * "copiar" under `done` would only be two strings to keep in step.
       */
      copy: string;
      copied: string;
      /**
       * The method picker, rendered only when the studio offers BOTH. With one
       * method enabled there is no choice to present and the page renders that
       * one directly, so this heading never appears over a single option.
       */
      chooseTitle: string;
      /**
       * One label and one line per method. The hint's whole job is to say what
       * happens AFTER the tap — MercadoPago settles it on the spot, a transfer
       * still owes us the proof — because that difference, not the brand, is
       * what the client is actually choosing between.
       */
      methods: {
        mercadopago: { label: string; hint: string };
        transfer: { label: string; hint: string };
      };
      /**
       * Checkout Pro runs on MercadoPago's own hosted page. `redirect` warns
       * the client they are about to leave, since a tab that changes domain
       * mid-flow otherwise reads as having lost the booking. `pending` covers
       * the gap after they come back: the return URL is a link the client
       * controls, so it is never what marks the booking paid — the webhook is,
       * and it can land a moment later.
       */
      mercadopago: {
        cta: string;
        redirect: string;
        pending: string;
      };
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
      /**
       * Carries two link placeholders, {studio} and {contact}, replaced at
       * render by anchors to the studio's map pin and to Bocha's Instagram
       * DMs. The labels below are the anchor text, so each language keeps its
       * own word order instead of being glued together from fragments.
       */
      body: string;
      studioLink: string;
      /**
       * Heads the address block, which renders ONLY when the wire carried an
       * address — i.e. a confirmed booking at a studio that has typed one into
       * the settings tab. See ConfirmedPanel; the page decides nothing.
       */
      addressTitle: string;
      /** Labels the door instructions under it: buzzer, floor, which bell. */
      arrivalLabel: string;
      /**
       * The studio is private, and with no address on the wire the door is
       * still sent by message. This is the fallback the address block replaces,
       * never a line shown next to a real address — it would contradict it.
       */
      addressNote: string;
      contactLink: string;
      sentTo: string;
      addToCalendar: string;
      /** Event summary written into the .ics file. */
      calendarTitle: string;
      /**
       * The variant for a booking MercadoPago paid. It says nothing about a
       * comprobante because there is none and there never will be — the
       * payment itself is the proof. `body` carries the same {studio} and
       * {contact} placeholders as `body` above, so both go through the same
       * renderer; `received` is the mono line that replaces the receipt chip,
       * with the timestamp appended by the caller exactly as that one is.
       *
       * The eyebrow and the title are NOT duplicated here: a confirmed
       * appointment reads the same however it got confirmed.
       */
      paid: {
        body: string;
        received: string;
      };
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
      /** The preference could not be created — nothing was charged. */
      paymentFailed: string;
      /** MercadoPago itself said no. Also nothing charged; another method may work. */
      paymentRejected: string;
    };
  };
};
