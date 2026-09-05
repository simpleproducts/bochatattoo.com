/**
 * The booking page's entire chrome: the wordmark and a language pair.
 *
 * Deliberately not `Nav` + `LocaleSwitcher`. Those rebuild the current path
 * from `usePathname`, which would work here but drags the site shell onto a
 * page whose whole job is one form. This page has exactly two URLs and the
 * token is right there, so the pair is built from it directly.
 *
 * The language pair uses plain <a>, not <Link>: a private link is not
 * something to prefetch into a neighbouring route's router cache, and the page
 * is `force-dynamic` + `no-store` anyway, so there is nothing a client-side
 * transition could save. The wordmark is an ordinary site link and stays a
 * <Link>.
 */
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
        className={`${TAP} font-mono text-xs uppercase tracking-[0.3em] hover:opacity-60 transition-opacity`}
      >
        {dict.booking.header.home}
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
