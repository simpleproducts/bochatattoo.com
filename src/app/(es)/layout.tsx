import type { Metadata } from "next";
import { RootShell } from "@/components/RootShell";
import { ImagesProvider } from "@/components/ImagesProvider";
import { getImagesData } from "@/lib/images-store";

export const metadata: Metadata = {
  metadataBase: new URL("https://bochatattoo.com"),
};

export default async function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const data = await getImagesData();
  return (
    <RootShell lang="es">
      <ImagesProvider data={data}>{children}</ImagesProvider>
    </RootShell>
  );
}
