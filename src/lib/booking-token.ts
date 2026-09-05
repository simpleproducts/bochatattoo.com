/**
 * The private booking link: minting and verification, with zero I/O.
 *
 *   payload = base64url(JSON.stringify([1, id, tokenEpoch]))
 *   sig     = base64url(HMAC-SHA256(payload, BOOKING_TOKEN_SECRET)).slice(0, 22)
 *   token   = `${payload}.${sig}`
 *
 * The signature is truncated to 22 base64url characters — 132 bits. RFC 2104 §5
 * permits truncating an HMAC to at least half its output (here 128 bits), and
 * the shorter tag is what keeps the whole link near 98 characters: short enough
 * to survive a WhatsApp message without wrapping onto three lines or being
 * mangled by a link preview. Anything longer buys no practical security and
 * costs the one place the link actually gets sent.
 *
 * Nothing in this module reads storage, and nothing ever should. Verification
 * is one HMAC over a string the caller already handed us, so a forged token
 * costs an attacker one hash and zero R2 reads — that is the brute-force floor
 * the rest of the feature stands on, and it disappears the moment a lookup is
 * added to parseBookingToken(). Everything that needs the record (revocation,
 * cancellation, expiry) happens one layer up, in verifyBookingAccess().
 *
 * The payload deliberately carries NO expiry. A link's lifetime is derived from
 * the appointment at check time (endsAt + LINK_GRACE_MS). Stamping an expiry at
 * mint time would mean that rescheduling an appointment two months out silently
 * kills a link Bocha already sent — the failure a client never reports, they
 * simply never arrive. Revocation is the epoch inside the payload, bumped on
 * the record; the clock is never part of the credential.
 *
 * A missing BOOKING_TOKEN_SECRET throws instead of falling back to a default
 * key: an unconfigured deploy must mint no links and accept none. The thrown
 * class is r2-private's BookingsNotConfiguredError — the single one in the
 * codebase — so a route catches one type for the whole feature's 503.
 */
import "server-only";
import {
  fromBase64Url,
  hmacBase64Url,
  randomBase64Url,
  timingSafeEqual,
  toBase64Url,
} from "./booking-crypto";
import { BOOKING_ID_RE, type BookingId } from "./bookings-types";
import { BookingsNotConfiguredError } from "./r2-private";
import { SITE_URL } from "./site";

export { BookingsNotConfiguredError };

/** 22 base64url chars = 132 bits. Read the header block before changing it. */
const SIG_CHARS = 22;

function tokenSecret(): string {
  const secret = process.env.BOOKING_TOKEN_SECRET;
  if (!secret) {
    throw new BookingsNotConfiguredError(
      "BOOKING_TOKEN_SECRET is not set on the server.",
    );
  }
  return secret;
}

/** 16 CSPRNG bytes → 22 base64url chars, so the result matches BOOKING_ID_RE. */
export function newBookingId(): BookingId {
  return `bk_${randomBase64Url(16)}`;
}

export async function mintBookingToken(
  id: BookingId,
  epoch: number,
): Promise<string> {
  const payload = toBase64Url(
    new TextEncoder().encode(JSON.stringify([1, id, epoch])),
  );
  const sig = (await hmacBase64Url(payload, tokenSecret())).slice(0, SIG_CHARS);
  return `${payload}.${sig}`;
}

export type TokenCheck =
  | { ok: true; id: BookingId; epoch: number }
  | { ok: false };

/**
 * Verify a token and read back what it claims. NO STORAGE ACCESS — see the
 * header block. Every failure returns the same bare `{ ok: false }`: the caller
 * has nothing to leak into a response, and there is no shape of malformed token
 * that can be told apart from a wrong signature from the outside.
 *
 * A missing secret throws rather than returning `{ ok: false }`, because "the
 * server is misconfigured" and "this link is fake" are different incidents and
 * must not be reported as the same one.
 */
export async function parseBookingToken(token: string): Promise<TokenCheck> {
  const secret = tokenSecret();
  // Split on the LAST ".": the payload alphabet is base64url, which contains no
  // dot, but splitting from the left would still hand a crafted token a payload
  // we never signed.
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false };
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  try {
    const expected = (await hmacBase64Url(payload, secret)).slice(0, SIG_CHARS);
    // Compared as decoded bytes, never with ===: a string compare returns at the
    // first differing character and turns the tag into a byte-at-a-time oracle.
    if (!timingSafeEqual(fromBase64Url(sig), fromBase64Url(expected))) {
      return { ok: false };
    }

    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payload)),
    );
    // Signed by us, but still parsed defensively: an older or future release of
    // this file may have signed a different tuple, and that is not this
    // version's booking.
    if (!Array.isArray(parsed) || parsed.length !== 3) return { ok: false };
    const [version, id, epoch] = parsed;
    if (version !== 1) return { ok: false };
    if (typeof id !== "string" || !BOOKING_ID_RE.test(id)) return { ok: false };
    if (typeof epoch !== "number" || !Number.isInteger(epoch)) {
      return { ok: false };
    }
    return { ok: true, id, epoch };
  } catch {
    // Undecodable base64url or unparseable JSON. Indistinguishable, on purpose.
    return { ok: false };
  }
}

/**
 * Both language variants of a link, re-derivable at any time from the record —
 * the token is a function of immutable data, so "show me that link again" costs
 * one HMAC and never forces a rotation. No percent-encoding: the token is
 * base64url plus a single ".", every character of which is path-safe.
 */
export function bookingLinks(token: string): { es: string; en: string } {
  return {
    es: `${SITE_URL}/book/${token}`,
    en: `${SITE_URL}/en/book/${token}`,
  };
}
