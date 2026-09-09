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
 * lat / lng — DELIBERATELY NOT THE STUDIO. These are the coordinates of
 *   Medrano-Almagro station on Subte line B (Av. Corrientes y Av. Medrano),
 *   about 200 m from the door.
 *
 *   This is a PRIVATE studio. The address is given to a client once their
 *   appointment is confirmed, by message, and it is not published anywhere on
 *   this site. Coordinates are an address: a `geo` block accurate to seven
 *   decimal places puts a pin on the actual door for anyone who reads the page
 *   source, which is exactly what "private" excludes. So the published point
 *   is the nearest public landmark instead — true, useful to a client working
 *   out how to get there, and it gives Google the Almagro signal that makes
 *   the site relevant to "tatuador cerca mío" without handing out the door.
 *
 *   If the studio ever DOES publish its address, replace these with the real
 *   ones and make them match the Google Business Profile exactly — a geo that
 *   disagrees with the profile is worse than no geo at all.
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
  /**
   * Medrano-Almagro station, Subte B — NOT the studio. See the note above
   * before changing these: the studio's own coordinates are private and must
   * not be published here or anywhere else on the public site.
   */
  lat: -34.60319,
  lng: -58.42094,

  /** Empty until the studio supplies them. Omitted from JSON-LD while empty. */
  streetAddress: "",
  postalCode: "",
  telephone: "",

  /** e.g. [{ days: ["Monday"], opens: "12:00", closes: "20:00" }] — empty until supplied. */
  openingHours: [] as { days: string[]; opens: string; closes: string }[],
};
