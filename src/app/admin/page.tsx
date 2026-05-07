import { getImagesData } from "@/lib/images-store";
import { AdminGallery } from "@/components/admin/AdminGallery";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await getImagesData();
  return <AdminGallery initialData={data} />;
}
