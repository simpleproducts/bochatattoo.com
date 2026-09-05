"use client";
/**
 * The admin's ES · EN pair.
 *
 * Same shape as `BookingHeader`'s language pair, and deliberately not
 * `LocaleSwitcher`: that one rebuilds the current path from `usePathname`,
 * which is the right answer for a site whose locale IS the path and the wrong
 * one here — the admin has a single set of URLs and its language lives in a
 * cookie (see src/lib/admin-locale.ts).
 *
 * So these are <button>s, not links. Setting `document.cookie` and calling
 * `router.refresh()` re-runs the server components with the other dictionary
 * and swaps every string in place, without a navigation, without an API route
 * and without a form post — the same refresh-after-mutation flow the gallery
 * and the calendar already use everywhere else.
 *
 * The one string it needs — the accessible name of the group — arrives as a
 * prop, exactly as it does for `LocaleSwitcher` and `BookingHeader`. Calling
 * `getAdminDictionary` here instead would be a VALUE import of @/i18n/admin
 * from inside a client boundary, which drags adminEs AND adminEn (~4 KB gzip,
 * duplicated into all three admin route chunks) into the browser for one
 * aria-label — on top of the correct dictionary the server already serialises
 * into every flight payload. This file is the only client component in the
 * admin that would do that; every other one imports the dictionary as a type,
 * which is erased. ADMIN_LOCALE_COOKIE / ADMIN_LOCALE_MAX_AGE stay imported:
 * src/lib/admin-locale.ts is written to survive the boundary.
 */
import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import { ADMIN_LOCALE_COOKIE, ADMIN_LOCALE_MAX_AGE } from "@/lib/admin-locale";

/**
 * Each control is a 44px tap target built out of padding only, so the type
 * keeps the 10px size and 0.3em tracking it has everywhere else in this
 * chrome. The negative margins pay for it — `-mx-3` against the buttons'
 * `px-3`, `-my-3.5` against the 44px height — so the pair occupies exactly the
 * line box its text would have occupied on its own and no admin header grows
 * a row taller. Lifted verbatim from BookingHeader.
 */
const TAP = "flex min-h-[44px] items-center px-3";

/**
 * Declared at module scope rather than inside the handler: writing
 * `document.cookie` from a component body is a mutation of something the
 * component does not own, which the React Compiler's immutability rule refuses
 * — correctly, since the value it writes is the one the SERVER reads back on
 * the very next render. Pulling it out states that plainly: this is a browser
 * side effect, not component state, and `router.refresh()` below is what turns
 * it back into rendered output.
 */
function persistAdminLocale(next: Locale): void {
  document.cookie = `${ADMIN_LOCALE_COOKIE}=${next}; path=/; max-age=${ADMIN_LOCALE_MAX_AGE}; SameSite=Lax`;
}

export function AdminLocaleSwitcher({
  locale,
  label,
}: {
  locale: Locale;
  /** `dict.common.language`, supplied by whichever page renders the pair. */
  label: string;
}) {
  const router = useRouter();

  const active = `${TAP} text-fg`;
  const idle = `${TAP} text-muted hover:text-fg transition-colors`;

  function choose(next: Locale) {
    // Nothing to do, and a refresh for nothing would blank the calendar's
    // in-flight state for as long as the transition lasts.
    if (next === locale) return;
    persistAdminLocale(next);
    router.refresh();
  }

  return (
    <nav
      aria-label={label}
      className="flex items-center font-mono text-[10px] uppercase tracking-[0.3em] -mx-3 -my-3.5"
    >
      {LOCALES.map((l, i) => (
        <Fragment key={l}>
          {i > 0 ? (
            <span className="text-muted" aria-hidden>
              ·
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => choose(l)}
            aria-current={l === locale ? "true" : undefined}
            className={`${l === locale ? active : idle} cursor-pointer`}
          >
            {LOCALE_LABELS[l]}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
