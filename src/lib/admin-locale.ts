/**
 * Where the admin's language lives.
 *
 * The public site reads its locale off the URL — the `(es)` and `(en)` route
 * groups make the path itself the answer, and `LocaleSwitcher` just rebuilds
 * the path. The admin cannot do that: it is ONE set of routes behind a session
 * cookie, and giving it a locale segment would double every admin URL, break
 * the `?b=<id>` deep link in the owner's notification email, and force
 * middleware's `/admin/:path*` matcher to learn about languages. So the admin's
 * locale is a cookie, set by the switcher in the browser and read here by the
 * server components that render the pages.
 *
 * The cookie is deliberately NOT httpOnly and carries no signature: it decides
 * which of two dictionaries is used and nothing else. Forging it buys an
 * attacker a page in the other language, which they could have had by clicking
 * the switcher.
 *
 * No `server-only`: `ADMIN_LOCALE_COOKIE` and `ADMIN_LOCALE_MAX_AGE` are read
 * by AdminLocaleSwitcher, which is a client component. That is exactly why
 * `next/headers` is imported dynamically inside `readAdminLocale` rather than
 * at the top of the file — the same idiom `requireAdmin()` uses in
 * admin-auth.ts, and here it is what keeps the module importable from both
 * sides of the boundary.
 */
import { isLocale, type Locale } from "@/i18n/config";

export const ADMIN_LOCALE_COOKIE = "ba_admin_locale";

/**
 * Spanish. Stated as a literal rather than borrowed from `DEFAULT_LOCALE`:
 * the public default is a marketing decision about visitors, this one is a
 * fact about the single person who signs in, and the two must be free to move
 * apart.
 */
export const DEFAULT_ADMIN_LOCALE: Locale = "es";

/** One year. The studio owner picks a language once, not every session. */
export const ADMIN_LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Anything that is not exactly "es" or "en" — absent, empty, a stale value
 * from an older build, a hand-edited cookie — is Spanish. There is no error
 * state here: an unreadable preference is simply not a preference.
 */
export function parseAdminLocale(value: string | undefined): Locale {
  return value !== undefined && isLocale(value) ? value : DEFAULT_ADMIN_LOCALE;
}

/**
 * The admin locale for the request being rendered. Server components only.
 *
 * Never throws. `cookies()` rejects when it is called outside a request scope
 * — a static prerender, a stray call from a module body — and the honest
 * answer to "which language?" in that situation is the default, not a 500 on
 * the screen the studio opens every morning.
 */
export async function readAdminLocale(): Promise<Locale> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    return parseAdminLocale(jar.get(ADMIN_LOCALE_COOKIE)?.value);
  } catch {
    return DEFAULT_ADMIN_LOCALE;
  }
}
