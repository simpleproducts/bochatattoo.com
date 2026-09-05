/**
 * What a refused link looks like: one panel, one sentence, two ways to reach a
 * human.
 *
 * Four variants, one per reason the token resolver can give. The page renders
 * this at HTTP 200 on purpose — the visitor is holding a link a person sent
 * them, and a 404 shell would read as "the site is broken" rather than "this
 * particular link is done".
 *
 * `bad-token` and `not-found` deliberately collapse into the same neutral
 * copy: telling the difference apart out loud would confirm whether a booking
 * id exists.
 */
import type { BookingInvalidProps } from "./contract";

export function BookingInvalid({ reason, dict }: BookingInvalidProps) {
  const v = dict.booking.invalid;
  const headline =
    reason === "link-expired"
      ? v.expired
      : reason === "link-revoked"
        ? v.revoked
        : reason === "booking-cancelled"
          ? v.cancelled
          : v.notFound;

  return (
    <section className="border border-line p-6 flex flex-col gap-3">
      <h1 className="font-serif italic text-3xl">{headline}</h1>
      <p className="text-base leading-relaxed text-fg/80">{v.help}</p>
      <div className="mt-2 flex flex-col gap-3">
        <a
          href="mailto:info@bochatattoo.com"
          className="self-start text-lg md:text-xl border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
        >
          {v.emailCta}
        </a>
        <a
          href="https://instagram.com/bocha.ttt"
          target="_blank"
          rel="noreferrer"
          className="self-start text-lg md:text-xl border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
        >
          {v.instagramCta}
        </a>
      </div>
    </section>
  );
}
