import { getImagesData } from "@/lib/images-store";
import { AdminGallery } from "@/components/admin/AdminGallery";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const data = await getImagesData();
  return <AdminGallery initialData={data} />;
}
