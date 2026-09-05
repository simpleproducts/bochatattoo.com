/**
 * ════════════════════════════════════════════════════════════════════════════
 *  THIS IS THE ONLY FILE TO EDIT TO TURN ON THE TRANSFER BLOCK.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Bank details shown to the client on the private booking page, above the
 * receipt uploader. Fill any of them in and the block appears; while `alias`
 * and `cbu` are both empty PAYMENT_ENABLED is false, the block is hidden, and
 * the client simply uploads whatever receipt they already have — the flow
 * still completes end to end.
 *
 * Not env vars: this is business data, not a secret (it is printed on the page
 * for anyone holding the link). Not a dictionary key either: the values are
 * byte-identical in Spanish and English, so duplicating them across es.ts and
 * en.ts would only create two places to get them wrong.
 */

/** Empty until the studio supplies the real account. Leave a field "" to hide its row. */
export const PAYMENT_DETAILS: {
  alias: string;
  cbu: string;
  holder: string;
  bank: string;
} = {
  alias: "",
  cbu: "",
  holder: "",
  bank: "",
};

/** Holder and bank alone are not enough to transfer to — the block needs a destination. */
export const PAYMENT_ENABLED = Boolean(PAYMENT_DETAILS.alias || PAYMENT_DETAILS.cbu);
