/**
 * The studio's Name / Address / Phone data, in one place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AN EMPTY VALUE HERE MEANS "OMITTED".
 * Every consumer of this file — the visible page and the LocalBusiness JSON-LD
 * — must skip a field while its value is empty, rather than render a blank
 * line or emit an empty property to Google.
 *
 * NEVER FILL ONE OF THESE IN WITH A GUESS.
 * A made-up street, postcode, phone number or opening hour is not a harmless
 * placeholder. Google cross-checks the address and phone on a site against the
 * Business Profile and every directory that has ever listed the business; a
 * detail that disagrees with them dissolves the match and pushes the studio
 * DOWN in local results. Worse than the ranking: it is a false statement on a
 * real business's website, and someone will eventually stand on that corner or
 * call that number. An absent field costs a little ranking. A wrong field
 * costs trust and is a lie. If nobody at the studio has confirmed it, it stays
 * "".
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HOW TO FILL EACH FIELD, AND WHAT IT UNLOCKS
 *
 * lat / lng — already real. Resolved from the studio's own Google Maps pin
 *   (the one STUDIO_MAPS_URL in src/lib/site.ts points at). They let the
 *   LocalBusiness carry a `geo` block, which is what ties the site to a point
 *   on the map for "tatuador cerca mío"-type searches even with no street
 *   address. The pin's venue is a shared address, not a business Bocha owns —
 *   use the coordinates, never the venue's name.
 *
 * streetAddress — the street and number as it is written on the Google
 *   Business Profile, character for character ("Av. Corrientes 1234, 2º B" and
 *   "Corrientes 1234 2B" are different strings to a matcher). Ask the studio
 *   for a copy/paste of the profile, not from memory. Filling it completes the
 *   PostalAddress, which is the single strongest signal that this site and
 *   that profile are the same business. Leave it empty while the studio is
 *   address-on-request: a private studio that only gives the address after a
 *   deposit should NOT publish it here.
 *
 * postalCode — CABA postcodes are the four-digit "1175" form or the eight-char
 *   CPA "C1175ABC". Whichever one the Business Profile uses is the one that
 *   goes here. Only meaningful alongside streetAddress; on its own it adds
 *   nothing, so fill both or neither.
 *
 * telephone — E.164, with the country code and no spaces or punctuation:
 *   "+5491122223333". A reachable phone number is one of the strongest local
 *   ranking signals there is, and on a phone it renders as a tap-to-call link,
 *   which converts far better than an email address. If the studio only takes
 *   contact through Instagram DM and email, leave this empty — the site
 *   already offers both — rather than publishing a personal mobile.
 *
 * openingHours — one entry per distinct block of hours, e.g.
 *     [{ days: ["Tuesday", "Wednesday", "Thursday"], opens: "12:00", closes: "20:00" }]
 *   Day names in English, capitalised, because schema.org's openingHoursSpecification
 *   expects those exact tokens; times in 24-hour "HH:MM". Split a day with a
 *   break into two entries. This is the other strong local signal: filled in,
 *   Google can show "Open now · closes 8 PM" against the result, which is a
 *   visible advantage over every competing listing that has no hours. Only
 *   publish hours the studio will actually honour — appointment-only studios
 *   are usually better served by an empty array than by hours nobody keeps.
 */
export const STUDIO = {
  /** Real. Do not round or "clean up" — the precision is the point. */
  lat: -34.6050123,
  lng: -58.420779,

  /** Empty until the studio supplies them. Omitted from JSON-LD while empty. */
  streetAddress: "",
  postalCode: "",
  telephone: "",

  /** e.g. [{ days: ["Monday"], opens: "12:00", closes: "20:00" }] — empty until supplied. */
  openingHours: [] as { days: string[]; opens: string; closes: string }[],
};
