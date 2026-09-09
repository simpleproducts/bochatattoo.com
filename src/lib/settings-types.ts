/**
 * Studio settings — the shape of bookings/settings.json, and the one function
 * that decides how much of it a client's browser is ever allowed to see.
 *
 * No `server-only` import, exactly like bookings-types.ts and trips-types.ts:
 * the private booking page renders its payment step from PublicPaymentSettings,
 * so this file must stay free of the S3 SDK and of every Node built-in.
 *
 * WHAT IS DELIBERATELY NOT IN HERE: the Brevo API key and the MercadoPago
 * access token. Those stay in Vercel env vars. This document is editable —
 * therefore readable — by anyone holding the one shared admin password, and it
 * round-trips through a browser form on every save, so a live payment
 * credential parked in it would be one screenshot, one shoulder, one reused
 * password away from being public. Settings answer WHICH methods are offered
 * and WHERE the money goes. The secrets that authenticate the studio to Brevo
 * and to MercadoPago are deploy configuration and belong with the deploy.
 *
 * EMPTY STRINGS ARE MEANINGFUL, and they mean "fall back", never "blank". The
 * chain is the one src/lib/email.ts and src/lib/booking-emails.ts already
 * implement, and settings only insert themselves at the front of it:
 *
 *   senderEmail  -> BREVO_SENDER_EMAIL   -> SITE_EMAIL
 *   senderName   -> BREVO_SENDER_NAME    -> "Bocha Tattoo"
 *   notifyEmail  -> BOOKING_NOTIFY_EMAIL -> SITE_EMAIL
 *
 * So a studio that never opens the settings tab keeps exactly the behaviour it
 * has today, and CLEARING a field is a supported way back to it rather than a
 * way to break sending — which is why the email fields are `string` and not
 * `string | null`: there is no third state to represent.
 */

/**
 * The two ways a deposit can arrive. Also the discriminator stored on a
 * booking's payment, so this union is what a paid record is read back through.
 */
export type PaymentMethod = "mercadopago" | "transfer";

/**
 * Bank transfer: whether it is offered, and the destination shown to the client.
 *
 * `enabled` is stored apart from the details on purpose. Turning the method off
 * for a week — while travelling, say — must not cost the studio a re-typed CBU
 * when they turn it back on, so the switch and the account are separate facts.
 */
export type TransferSettings = {
  enabled: boolean;
  alias: string;
  cbu: string;
  holder: string;
  bank: string;
};

/**
 * Who booking mail comes FROM and where its notifications LAND. Never public:
 * `notifyEmail` is the studio's own inbox, not the client's business, and it is
 * the field toPublicPaymentSettings() exists to keep off the wire.
 */
export type EmailSettings = {
  /** "" -> BREVO_SENDER_EMAIL -> SITE_EMAIL. See the header. */
  senderEmail: string;
  /** "" -> BREVO_SENDER_NAME -> "Bocha Tattoo". */
  senderName: string;
  /** Where a new booking notifies the studio. "" -> BOOKING_NOTIFY_EMAIL -> SITE_EMAIL. */
  notifyEmail: string;
};

/**
 * WHERE THE STUDIO IS. The single most restricted value in this document, and
 * the reason it is stored here rather than in src/config/studio.ts: that file is
 * compiled into the public site and read by JsonLd, so anything put in it is
 * published by definition. This one is read out of the private bucket at request
 * time, and reaches a human only through the gate in toPublicView().
 *
 * This is a PRIVATE studio. The address is disclosed to exactly one audience —
 * a client whose booking deriveStatus() calls "confirmed" — in exactly two
 * places: their own tokenised booking page, and the confirmation email sent on
 * that same transition. The private link travels by WhatsApp and gets forwarded
 * long before anyone has paid, so a booking that is not yet confirmed must
 * produce a response with no address in it at all.
 *
 * Both fields are `string` and not `string | null` for the reason the header
 * gives: "" is a real value meaning "not set", and there is no third state.
 */
export type StudioSettings = {
  /** Street address, given only to confirmed clients. "" means not set. */
  address: string;
  /** Buzzer, floor, "ring twice", nearest corner — anything that helps at the door. "" means not set. */
  arrivalNote: string;
};

/** The whole document. One object; see settings-store.ts for the key and the CAS. */
export type Settings = {
  version: 1;
  email: EmailSettings;
  transfer: TransferSettings;
  mercadopago: { enabled: boolean };
  /** Never public. See StudioSettings, and the gate in bookings-store.ts. */
  studio: StudioSettings;
  /** UTC ISO. Stamped by the store on every committed write, never by a caller. */
  updatedAt: string;
};

/**
 * What the CLIENT page is allowed to see. Email settings never cross this line.
 *
 * A separate type rather than a runtime filter over Settings, because the
 * compiler is the only reviewer guaranteed to look: a field added to
 * EmailSettings next year has nowhere to go in this shape, so it cannot reach a
 * browser by accident — it can only get there if someone types it out below.
 */
export type PublicPaymentSettings = {
  transfer: TransferSettings;
  mercadopago: { enabled: boolean };
};

/**
 * Narrow the document to its public half.
 *
 * Built FIELD BY FIELD rather than by destructuring `email` off and spreading
 * the rest, and that is the whole point of the function. A spread with
 * omissions is a denylist: the day someone adds `email.replyTo`, or an
 * `internalNote` to the transfer block, or any second secret-ish field to
 * Settings, a spread ships it to every visitor holding a booking link and
 * nothing anywhere errors. Typed out, a new field is simply absent here until a
 * human decides it should be public — including inside `transfer`, which is
 * entirely public TODAY and has no guarantee of staying that way.
 *
 * `studio` IS NOT PART OF THIS AND MUST NEVER BE ADDED TO IT. Not the address,
 * not the arrival note, not a boolean saying whether an address exists. What
 * this function returns is handed to the client booking page WHOLESALE, on every
 * booking in every state — red, amber and green alike — because the payment step
 * has to render before anybody has paid. The address is disclosed on exactly one
 * condition, and that condition is a property of the BOOKING, not of the
 * settings, so it cannot be expressed here: adding `studio` to
 * PublicPaymentSettings would publish the studio's address to everyone holding a
 * forwarded link. The one place allowed to read it is toPublicView() in
 * bookings-store.ts, which has the booking in hand and can check its status.
 */
export function toPublicPaymentSettings(s: Settings): PublicPaymentSettings {
  return {
    transfer: {
      enabled: s.transfer.enabled,
      alias: s.transfer.alias,
      cbu: s.transfer.cbu,
      holder: s.transfer.holder,
      bank: s.transfer.bank,
    },
    mercadopago: { enabled: s.mercadopago.enabled },
  };
}

/**
 * What an unwritten settings document means.
 *
 * BOTH METHODS OFF is the only safe default. A payment method offered before
 * anyone has configured it sends a client to a MercadoPago preference the token
 * cannot create, or shows them an empty CBU to transfer into — both worse than
 * a booking page that simply does not offer to take money yet.
 *
 * The email fields are "" for the reason spelled out in the header: that is the
 * value the fallback chain reads as "nobody has chosen, use the env var".
 */
export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  email: { senderEmail: "", senderName: "", notifyEmail: "" },
  transfer: { enabled: false, alias: "", cbu: "", holder: "", bank: "" },
  mercadopago: { enabled: false },
  // Empty until a human types it into the settings tab. An unset address is not
  // a broken state: the gate simply finds nothing to disclose and the confirmed
  // client's page shows no address block at all, which is strictly better than
  // any placeholder a default could invent.
  studio: { address: "", arrivalNote: "" },
  // The epoch, because these defaults were never saved by anyone. It keeps
  // `updatedAt` a plain non-null string — every consumer can format it without
  // a guard — while still being obviously not a real save: any actual write
  // moves it to now, and a settings tab showing 1970 is telling the truth.
  updatedAt: "1970-01-01T00:00:00.000Z",
};

/**
 * Storage ceilings, not validators — the settings route decides what a usable
 * value is, exactly as the booking routes do for everything else.
 *
 * They are deliberately loose. A CBU is 22 digits and an alias is 6 to 20
 * characters, so these leave room for the spaces, dots and dashes a studio
 * pastes in from their banking app without ever accepting an essay in a field
 * that gets printed on a client's screen.
 */
export const CBU_MAX = 34;
export const ALIAS_MAX = 40;
export const HOLDER_MAX = 80;
export const BANK_MAX = 60;

/**
 * Room for "Av. Corrientes 1234, Piso 5 Depto B, Villa Crespo, CABA" and then
 * some, without leaving room for directions that belong in the note below.
 */
export const ADDRESS_MAX = 200;

/**
 * Longer than the address on purpose: this is prose, not a field. "Timbre 5B,
 * tocá dos veces. El portón verde al lado del kiosco — si no abre, mandame un
 * WhatsApp." is the shape of the thing, and it is printed on a confirmed
 * client's page and in their email, so it has to fit both.
 */
export const ARRIVAL_NOTE_MAX = 300;
