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

/** The studio, on Google Maps. Shortlink so it survives being pasted anywhere. */
export const STUDIO_MAPS_URL = "https://maps.app.goo.gl/KeshNw1dSqBvvmfn6";
