/**
 * /book/<token> — the Spanish half of the private booking page.
 *
 * The URL is the credential, so the shell is deliberately bare: no SiteShell,
 * no Nav, no Footer. A newsletter form under a consent gate is noise, and every
 * outbound link removed is one fewer place the token can leak.
 *
 * Three rules here are easy to undo by accident:
 *
 *  1. No `alternates`, no `openGraph`, and `robots` says index:false /
 *     follow:false / nocache:true. A private link must not be advertised
 *     anywhere, and a canonical tag or an OG card is a published URL.
 *  2. HTTP 200 in every branch, refusals included. `notFound()` would serve the
 *     site's 404 shell to someone holding a link a friend forwarded, which
 *     reads as "the site is broken" rather than "this particular link is done".
 *  3. THE ORACLE RULE runs the opposite way here than it does in the API. By
 *     the time verifyBookingAccess can say "revoked" or "expired", the visitor
 *     has already proven they hold a token we signed, so the humane copy tells
 *     them nothing they could not already derive. `bad-token` and `not-found`
 *     still collapse into one neutral panel — telling those two apart would
 *     confirm whether a booking id exists.
 *
 * The EN twin at src/app/(book-en)/en/book/[token]/page.tsx is this file with a
 * different `locale` and a different function name, the same way every other
 * page in this repo is paired.
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { BookingInvalid } from "@/components/booking/BookingInvalid";
import { getDictionary } from "@/i18n";
import { toPublicView, verifyBookingAccess } from "@/lib/bookings-store";
import type {
  BookingAccessReason,
  PublicBookingView,
} from "@/lib/bookings-types";
import { ipFromHeaders, rateLimit } from "@/lib/rate-limit";

const locale = "es" as const;
const dict = getDictionary(locale);

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: dict.booking.metaTitle,
  robots: { index: false, follow: false, nocache: true },
};

/** The §7.3 container. BookingFlow carries its own copy for the happy path. */
const SHELL = "max-w-md mx-auto px-6 py-10 md:py-16 flex flex-col gap-8";

type Resolved =
  | { ok: true; view: PublicBookingView }
  | { ok: false; reason: BookingAccessReason };

/**
 * Kept out of the component, and JSX-free, for one blunt reason: React does not
 * render a returned element inside the call that built it, so a `try` wrapped
 * around JSX catches nothing. The I/O lives here; the rendering lives there.
 */
async function resolve(token: string): Promise<Resolved> {
  try {
    const access = await verifyBookingAccess(token);
    if (!access.ok) return { ok: false, reason: access.reason };
    return { ok: true, view: toPublicView(access.record) };
  } catch (err) {
    // An unset bucket, a missing signing key, a sulking R2. None of it is
    // something the reader can act on, and none of it may reach their screen.
    console.error("book page: failed to resolve booking link", err);
    return { ok: false, reason: "not-found" };
  }
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const refuse = (reason: BookingAccessReason) => (
    <main className={SHELL}>
      <BookingInvalid reason={reason} dict={dict} />
    </main>
  );

  // Before any R2 read, exactly like the public API routes: a burst of forged
  // tokens must cost this instance a Map lookup, not a GET per request.
  const limited = rateLimit("book-page", ipFromHeaders(await headers()), {
    limit: 60,
    windowMs: 300_000,
  });
  // A page cannot answer 429 without falling back to the 404 shell rule 2
  // forbids, so a throttled visitor gets the neutral panel — which is also the
  // only honest variant available, since nothing about this token has been
  // verified yet. It still hands them two ways to reach a human.
  if (!limited.ok) return refuse("not-found");

  const resolved = await resolve(token);
  if (!resolved.ok) return refuse(resolved.reason);

  return (
    <BookingFlow
      view={resolved.view}
      token={token}
      locale={locale}
      dict={dict}
    />
  );
}
