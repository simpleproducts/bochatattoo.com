import { getImagesDataFresh } from "@/lib/images-store";
import { AdminGallery } from "@/components/admin/AdminGallery";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminDictionary } from "@/i18n/admin";
import { readAdminLocale } from "@/lib/admin-locale";

export const dynamic = "force-dynamic";

/**
 * The image library — Images and Categories, two views of one page.
 *
 * Which one shows is a query string rather than client state so that both are
 * real, linkable URLs and the shared tab bar in AdminNav can point straight at
 * them. `searchParams` is a Promise in Next 16.
 *
 * The locale is read here, on the server, and handed down as props. The admin
 * has no locale segment to read it off — it lives in a cookie — so this page is
 * the one place that knows the language, exactly as the booking pages resolve
 * `dict` before handing it to BookingFlow.
 */
export default async function AdminGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const [data, params, locale] = await Promise.all([
    getImagesDataFresh(),
    searchParams,
    readAdminLocale(),
  ]);
  return (
    <AdminGallery
      initialData={data}
      tab={params.tab === "categories" ? "categories" : "images"}
      locale={locale}
      dict={getAdminDictionary(locale)}
    />
  );
}
