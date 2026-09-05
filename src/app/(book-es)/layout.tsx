import type { Metadata } from "next";
import { RootShell } from "@/components/RootShell";

/**
 * Root layout for the Spanish private booking page.
 *
 * THIS ROUTE MUST NEVER BE WRAPPED IN AN ANALYTICS LAYOUT. The booking URL
 * contains the token that authorises reading a client's details and writing
 * their bank receipt — the URL *is* the credential. GA4 sends the full page
 * location as `dl`, the Meta Pixel does the same, and `@vercel/analytics`
 * reports `usePathname()` verbatim; any one of them turns a legitimate client
 * visit into a permanent record of the token in a third-party console. The
 * `Referrer-Policy: no-referrer` and `X-Robots-Tag` headers in next.config.ts
 * are response headers and cannot restrain a first-party script reading
 * `location.href`.
 *
 * That is why these pages live in their own route group instead of under
 * `(es)`, whose layout renders <Analytics /> and whose RootShell renders
 * <Tracking />. The booking tree uses no ImagesProvider, so nothing is lost by
 * leaving that group. Its English twin is src/app/(book-en)/layout.tsx.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://bochatattoo.com"),
  robots: { index: false, follow: false, nocache: true },
};

export default function BookLayoutEs({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RootShell lang="es" tracking={false}>
      {children}
    </RootShell>
  );
}
