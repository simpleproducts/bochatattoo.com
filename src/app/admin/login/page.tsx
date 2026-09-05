/**
 * The sign-in screen.
 *
 * A server component like every other admin page, so the language comes from
 * the cookie (see src/lib/admin-locale.ts) and the strings come from the admin
 * dictionary — the same `readAdminLocale()` + `getAdminDictionary()` pair the
 * calendar and the gallery use.
 *
 * The switcher is rendered HERE, on the one screen that has no header cluster
 * to hang it on, because this is the only screen an unsigned-in person sees:
 * someone who cannot read "Contraseña" has no way to reach the switcher that
 * lives behind the password. It is the only thing added to a page that is one
 * of middleware's PUBLIC_PATHS — it links nowhere, says nothing about the
 * studio's bookings or images, and only writes a two-letter cookie.
 */
import { AdminLocaleSwitcher } from "@/components/admin/AdminLocaleSwitcher";
import { getAdminDictionary } from "@/i18n/admin";
import { readAdminLocale } from "@/lib/admin-locale";

type SearchParams = { from?: string; error?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { from, error } = await searchParams;
  const locale = await readAdminLocale();
  const dict = getAdminDictionary(locale);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form
        action="/api/admin/login"
        method="post"
        className="w-full max-w-sm flex flex-col gap-6"
      >
        {/*
          The pair sits on the eyebrow's line rather than above the form: the
          switcher carries its own negative margins, so aligning it to the top
          of this block lands its type on the eyebrow's baseline and its text
          on the form's right edge without giving the block a taller first row.
        */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              {dict.common.admin}
            </span>
            <h1 className="font-serif italic text-4xl">{dict.login.title}</h1>
          </div>
          <AdminLocaleSwitcher locale={locale} label={dict.common.language} />
        </div>

        <input type="hidden" name="from" value={from ?? "/admin"} />

        <label className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {dict.login.password}
          </span>
          <input
            type="password"
            name="password"
            autoFocus
            required
            autoComplete="current-password"
            className="bg-transparent border border-line px-3 py-2 text-fg focus:outline-none focus:border-fg"
          />
        </label>

        {error ? (
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-red-400">
            {dict.login.wrongPassword}
          </p>
        ) : null}

        <button
          type="submit"
          className="border border-fg px-4 py-2 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors cursor-pointer"
        >
          {dict.login.submit}
        </button>
      </form>
    </main>
  );
}
