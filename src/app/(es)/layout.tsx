import type { Metadata } from "next";
import { RootShell } from "@/components/RootShell";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  metadataBase: new URL("https://bochatattoo.com"),
};

/**
 * No ImagesProvider here on purpose: anything the layout hands a client
 * provider ships with EVERY page under it. Each page that shows work wraps
 * itself with just its own slice — see pickImages in lib/images-store.ts.
 */
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RootShell lang="es">
      <Analytics/>
      {children}
    </RootShell>
  );
}
