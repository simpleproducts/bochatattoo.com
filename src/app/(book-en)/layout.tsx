import type { Metadata } from "next";
import { RootShell } from "@/components/RootShell";

/**
 * Root layout for the English private booking page.
 *
 * THIS ROUTE MUST NEVER BE WRAPPED IN AN ANALYTICS LAYOUT — see the full
 * reasoning in its Spanish twin, src/app/(book-es)/layout.tsx. The short
 * version: the booking URL carries the token that authorises reading a
 * client's details and writing their bank receipt, and every analytics script
 * on this site reports the URL it was rendered on.
 *
 * Two layouts rather than one because <html lang> is set here, statically, per
 * language — the same split the rest of this repo uses for (es) and (en).
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://bochatattoo.com"),
  robots: { index: false, follow: false, nocache: true },
};

export default function BookLayoutEn({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RootShell lang="en" tracking={false}>
      {children}
    </RootShell>
  );
}
