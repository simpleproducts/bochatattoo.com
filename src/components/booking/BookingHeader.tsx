/**
 * The booking page's entire chrome: the logo and a language pair.
 *
 * Deliberately not `Nav` + `LocaleSwitcher`. Those rebuild the current path
 * from `usePathname`, which would work here but drags the site shell onto a
 * page whose whole job is one form. This page has exactly two URLs and the
 * token is right there, so the pair is built from it directly.
 *
 * The language pair uses plain <a>, not <Link>: a private link is not
 * something to prefetch into a neighbouring route's router cache, and the page
 * is `force-dynamic` + `no-store` anyway, so there is nothing a client-side
 * transition could save. The logo is an ordinary site link and stays a <Link>.
 *
 * The mark is the same asset and the same treatment `Nav` uses, so a client
 * arriving cold from a WhatsApp message sees the thing they will also see on
 * the site itself. `dict.booking.header.home` stopped being visible text and
 * became the alt — the name still reaches a screen reader and an image that
 * fails to load still says who this is.
 */
import Image from "next/image";
import Link from "next/link";
import { LOCALE_LABELS } from "@/i18n/config";
import type { BookingHeaderProps } from "./contract";

/**
 * Every control here is a 44px tap target, built out of padding only — the
 * type keeps the size and weight it had. The header pays for that with
 * matching negative margins (`-mx-3` against the links' `px-3`, `-my-3.5`
 * against the 44px height) so the wordmark and the language pair sit exactly
 * where they did: the targets grow into the page gutter and the gap below,
 * both of which have room to spare.
 */
const TAP = "flex min-h-[44px] items-center px-3";

export function BookingHeader({ token, locale, dict }: BookingHeaderProps) {
  const active = `${TAP} text-fg`;
  const idle = `${TAP} text-muted hover:text-fg transition-colors`;

  return (
    <header className="flex items-center justify-between -mx-3 -my-3.5">
      <Link
        href="/"
        aria-label={dict.booking.header.home}
        className={`${TAP} hover:opacity-60 transition-opacity`}
      >
        <span className="relative block w-10 h-10">
          <Image
            src="/logo/logo-white.png"
            alt={dict.booking.header.home}
            fill
            sizes="40px"
            priority
            className="object-contain"
          />
        </span>
      </Link>
      <nav
        aria-label={dict.localeSwitcher.label}
        className="flex items-center font-mono text-[10px] uppercase tracking-[0.3em]"
      >
        <a
          href={`/book/${token}`}
          aria-current={locale === "es" ? "true" : undefined}
          className={locale === "es" ? active : idle}
        >
          {LOCALE_LABELS.es}
        </a>
        <span className="text-muted" aria-hidden>
          ·
        </span>
        <a
          href={`/en/book/${token}`}
          aria-current={locale === "en" ? "true" : undefined}
          className={locale === "en" ? active : idle}
        >
          {LOCALE_LABELS.en}
        </a>
      </nav>
    </header>
  );
}
