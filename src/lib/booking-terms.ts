/**
 * ════════════════════════════════════════════════════════════════════════════
 *  THIS IS THE ONLY FILE TO EDIT WHEN THE REAL TERMS ARRIVE.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The booking agreement the client accepts before uploading a receipt. The
 * headings below are already the real ones; every BODY is placeholder lorem
 * ipsum until the studio supplies the legal text.
 *
 * When that text lands, three edits — all of them here:
 *   1. Replace the section bodies (and add/remove sections freely).
 *   2. Bump TERMS_VERSION. That invalidates prior acceptances for NEW
 *      submissions only: a record already carries the version it was accepted
 *      under in `client.termsVersion` and is never rewritten, so past bookings
 *      stay valid evidence of what was actually agreed to.
 *   3. Flip TERMS_REQUIRE_SCROLL to true, so the accept checkbox unlocks only
 *      after the client has reached the end of the text.
 *
 * Deliberately NOT a dictionary key: the terms change on a legal cadence, and
 * a legal edit must never be able to break the Dictionary type that gates the
 * whole site build.
 *
 * Plain strings only — no HTML, no markdown. They are rendered as React text
 * nodes; nothing here is ever passed to dangerouslySetInnerHTML.
 */
import type { Locale } from "@/i18n/config";

/**
 * Date-shaped so a human can tell at a glance which text a stored acceptance
 * refers to. Compared for equality only — never parsed or ordered.
 */
export const TERMS_VERSION = "2026-09-01";

/**
 * Gate the accept checkbox behind reading the whole document. Ships `false`:
 * scroll-gating lorem ipsum is pure friction at the exact moment we need none.
 * Annotated `boolean` (not the literal) so flipping it never needs a matching
 * edit in TermsModal.
 */
export const TERMS_REQUIRE_SCROLL: boolean = false;

export type TermsDoc = {
  title: string;
  sections: { heading: string; body: string }[];
};

export const TERMS: Record<Locale, TermsDoc> = {
  es: {
    title: "Términos y condiciones",
    sections: [
      {
        heading: "Seña y reserva del turno",
        body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
      },
      {
        heading: "Cancelaciones y reprogramación",
        body: "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
      },
      {
        heading: "Demoras y ausencias",
        body: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam.",
      },
      {
        heading: "Salud y contraindicaciones",
        body: "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur. At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti. Et harum quidem rerum facilis est et expedita distinctio, nam libero tempore cum soluta nobis est eligendi optio. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.",
      },
      {
        heading: "Derechos de imagen",
        body: "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus. Omnis voluptas assumenda est, omnis dolor repellendus. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.",
      },
    ],
  },
  en: {
    title: "Terms and conditions",
    sections: [
      {
        heading: "Deposit and booking",
        body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
      },
      {
        heading: "Cancellations and rescheduling",
        body: "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
      },
      {
        heading: "Lateness and no-shows",
        body: "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam.",
      },
      {
        heading: "Health and contraindications",
        body: "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur. At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti. Et harum quidem rerum facilis est et expedita distinctio, nam libero tempore cum soluta nobis est eligendi optio. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.",
      },
      {
        heading: "Image rights",
        body: "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus. Omnis voluptas assumenda est, omnis dolor repellendus. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.",
      },
    ],
  },
};
