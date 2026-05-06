import type { Metadata } from "next";
import { RootShell } from "@/components/RootShell";

export const metadata: Metadata = {
  metadataBase: new URL("https://bochatattoo.com"),
};

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootShell lang="es">{children}</RootShell>;
}
