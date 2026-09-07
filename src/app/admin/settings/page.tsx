/**
 * /admin/settings — the server half of the fourth tab.
 *
 * The whole document is read here and handed down as one prop, the same server
 * fetch -> prop flow the calendar and the gallery use. There is no client
 * fetch on mount: the form is rendered from the document, and the PUT answers
 * with what landed, so nothing on this screen ever has to ask again.
 *
 * Already covered by middleware's "/admin/:path*" matcher entry; `requireAdmin()`
 * is the second, defence-in-depth check the other admin pages also make.
 *
 * `mercadoPagoConfigured()` is called HERE, on the server, and crosses to the
 * browser as a boolean. The access token is what it reads and the token is
 * exactly what may not travel — see the header of src/lib/settings-types.ts.
 * A client component cannot answer this question for itself, which is why it
 * is a prop rather than something AdminSettings works out.
 *
 * UNLIKE THE CALENDAR PAGE, a failed read is not swallowed into an empty
 * screen. The calendar renders its config panel because Bocha needs the
 * schedule even when R2 is sulking; this form would instead come up showing
 * DEFAULT_SETTINGS — both methods off, every bank field blank — and the next
 * Save would write that over the studio's real details. A form is only as safe
 * as the document it was seeded from, so a read that did not happen has to be
 * an error and not a blank page. loadSettings() already treats "never written"
 * as DEFAULT_SETTINGS rather than as a failure, so the only thing that reaches
 * this boundary is a genuinely broken or unconfigured bucket.
 */
import { requireAdmin } from "@/lib/admin-auth";
import { readAdminLocale } from "@/lib/admin-locale";
import { getAdminDictionary } from "@/i18n/admin";
import { mercadoPagoConfigured } from "@/lib/mercadopago";
import { loadSettings } from "@/lib/settings-store";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminSettings } from "@/components/admin/AdminSettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();

  // The admin's language is a cookie, not a URL segment (src/lib/admin-locale.ts
  // says why), so the server reads it here and hands the screen its words as a
  // prop. No `locale` travels with it: unlike the calendar, nothing on this
  // page is a date or a number that needs formatting in one.
  const locale = await readAdminLocale();
  const dict = getAdminDictionary(locale);
  const settings = await loadSettings();

  return (
    // The nav lives INSIDE <main>, exactly as it does on the calendar and
    // gallery pages, so the tab bar picks up the same px-4/md:px-8 inset as
    // everything under it.
    <main className="flex-1 px-4 md:px-8 py-6 flex flex-col gap-6">
      <AdminNav active="settings" dict={dict} />
      <AdminSettings
        initial={settings}
        mercadoPagoReady={mercadoPagoConfigured()}
        dict={dict}
      />
    </main>
  );
}
