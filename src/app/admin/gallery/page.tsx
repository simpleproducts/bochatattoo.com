import { getImagesDataFresh } from "@/lib/images-store";
import { AdminGallery } from "@/components/admin/AdminGallery";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * The image library — Images and Categories, two views of one page.
 *
 * Which one shows is a query string rather than client state so that both are
 * real, linkable URLs and the shared tab bar in AdminNav can point straight at
 * them. `searchParams` is a Promise in Next 16.
 */
export default async function AdminGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const [data, params] = await Promise.all([
    getImagesDataFresh(),
    searchParams,
  ]);
  return (
    <AdminGallery
      initialData={data}
      tab={params.tab === "categories" ? "categories" : "images"}
    />
  );
}
