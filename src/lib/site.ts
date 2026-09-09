/**
 * The site's absolute origin, in one place.
 *
 * No `server-only`: client components build links with it too (the share row,
 * the booking language pair). `NEXT_PUBLIC_` so the value is inlined at build
 * time — set it on preview deploys or the private links minted there will
 * point at production.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bochatattoo.com";

/**
 * The studio's public address — the same one Contact.tsx, Footer.tsx and
 * BookingInvalid.tsx already link to.
 *
 * It is the default on BOTH ends of booking mail: the From address and the
 * address owner notifications land at. That is deliberate — it means the
 * feature sends real mail with no new env var at all, reusing the Brevo key the
 * newsletter already uses. Override either end only if they ever need to
 * differ (a separate no-reply sender, or notifications to a second inbox).
 */
export const SITE_EMAIL = "info@bochatattoo.com";

/** Instagram handle, without the "@". */
export const INSTAGRAM_HANDLE = "bocha.ttt";

/** Profile link — the same one Contact.tsx and the footer use. */
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;

/**
 * Opens a DIRECT MESSAGE rather than the profile. `ig.me/m/<handle>` is
 * Instagram's own deep link: on a phone it lands in the app's message
 * composer, and on desktop it falls back to the web inbox. A confirmed client
 * asking a question should not have to find the message button themselves.
 */
export const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_HANDLE}`;

/**
 * MEDRANO STATION, not the studio.
 *
 * The studio is private and its address goes to a client by message once the
 * appointment is confirmed — never on the site, and never in a link that ends
 * up in an inbox, a browser history or a forwarded WhatsApp message. So the
 * pin every public surface points at is the nearest Subte stop (line B,
 * Av. Corrientes y Av. Medrano, about 200 m away), which is the part of the
 * journey a client actually needs help with anyway.
 *
 * Coordinate form rather than a shortlink: it cannot silently start resolving
 * to a different place, and it carries no venue name that could be mistaken
 * for the studio's.
 */
export const STUDIO_MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=-34.60319%2C-58.42094";
