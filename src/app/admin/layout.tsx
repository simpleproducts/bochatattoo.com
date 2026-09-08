import "@/app/globals.css";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ImagesProvider } from "@/components/ImagesProvider";
import { getImagesDataFresh } from "@/lib/images-store";
import { readAdminLocale } from "@/lib/admin-locale";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

/**
 * The admin installs to the home screen as its own app; the public marketing
 * site deliberately does not. Everything that makes that true lives in THIS
 * file, because this layout wraps /admin/* and nothing else — the public site
 * has its own root layouts under (es)/(en)/(book-*).
 *
 * Why the manifest is a static file in public/ and not `src/app/manifest.ts`:
 *
 *  1. `src/app/manifest.ts` resolves to /manifest.webmanifest — a fine URL,
 *     outside middleware's matcher — but Next's file-based metadata applies to
 *     every route BELOW the file, and there is no root layout here to scope it.
 *     Verified by experiment: adding that file puts `<link rel="manifest">` in
 *     the head of the public homepage, which would offer to install the tattoo
 *     portfolio as an app. That alone rules the approach out.
 *  2. `src/app/admin/manifest.ts` resolves to /admin/manifest.webmanifest, which
 *     middleware's `/admin/:path*` matcher is written to catch. A browser
 *     fetches a manifest as a plain subresource, so it would take the 302 to
 *     /admin/login, try to parse HTML as JSON, and refuse to install with no
 *     error the operator could see.
 *
 * Reason 2 is latent rather than active right now, and the evidence is
 * confusing enough to be worth writing down. middleware.ts sits at the repo
 * root while the app is under src/, where Next wants src/middleware.ts. It is
 * still COMPILED from there — `next build` prints `ƒ Proxy (Middleware)` and
 * .next/server/middleware-manifest.json holds all four matchers — but it is
 * never INVOKED: with no cookie, /admin/zzz-does-not-exist answers 404 and
 * /api/admin answers 404, where a running matcher would have redirected and
 * 401'd before routing ever reached them. The redirects /admin and
 * /admin/settings do serve come from requireAdmin() in the pages themselves,
 * which is why they carry no `?from=` — middleware adds that, requireAdmin
 * does not. So the admin is guarded, just by belt and not by suspenders.
 *
 * Do not read that build line as "the matcher is dead, /admin is a safe place
 * for the manifest". Moving it there breaks the day someone renames the file
 * to src/middleware.ts, and it breaks silently.
 *
 * A static public/manifest.webmanifest is served from a path the matcher does
 * not cover, and is linked from here only. Same reasoning puts the icons at
 * /icons/* rather than anywhere under /admin.
 *
 * NO SERVICE WORKER, and please do not add one. The obvious next step from
 * "make it installable" is "make it work offline", but the calendar reads live
 * bookings from R2: a cached view that shows a slot which was already cancelled,
 * or hides one that was just booked, sends the owner to the studio at the wrong
 * time. A page that fails to load says so; a stale one lies. iOS never required
 * a service worker to install, and Chrome dropped the requirement — a manifest
 * over HTTPS is enough for the install prompt.
 */
export const metadata: Metadata = {
  title: "Admin · Bocha Tattoo",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    // The home-screen label under the icon. Kept short because iOS truncates
    // past ~12 characters, and "Admin · Bocha Tattoo" would render as "Admin…".
    title: "Bocha Admin",
    // Dark app on a near-black background: "default" paints a light bar with
    // dark glyphs and "black" reserves an opaque strip above the content.
    // "black-translucent" lets the app own the full height — which is also what
    // makes env(safe-area-inset-top) report the real notch, so the sticky
    // agenda bar can clear it.
    statusBarStyle: "black-translucent",
  },
  // Declaring `icons` here overrides the file-based src/app/{icon,apple-icon}.png
  // convention FOR THIS SUBTREE ONLY — those files are untouched and the public
  // site still uses them. The admin needs its own set anyway: the tab icon
  // should be the dark-background mark, and iOS reads apple-touch-icon rather
  // than the manifest when adding to the home screen. Listing `icon` explicitly
  // is not optional — without it the override leaves admin tabs with no favicon
  // at all, falling back to a /favicon.ico that does not exist.
  icons: {
    icon: [
      { url: "/icons/admin-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/admin-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/admin-apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  other: {
    // Next 16's `appleWebApp.capable` emits only the modern, unprefixed
    // `mobile-web-app-capable`. iOS before 17 reads only the apple-prefixed
    // spelling, and the owner's phone is not guaranteed to be current, so the
    // legacy tag is added by hand here. Metadata has no field for it.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  // Required for env(safe-area-inset-*) to report anything but 0 on a notched
  // phone. Without it the insets are always zero and the standalone padding in
  // globals.css silently does nothing.
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // <html lang> has to agree with what the page actually says, or a screen
  // reader announces Spanish copy with an English voice and Safari offers to
  // translate a page that is already in the reader's language.
  const [data, locale] = await Promise.all([
    getImagesDataFresh(),
    readAdminLocale(),
  ]);
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body
        // `admin-safe-shell` (globals.css) is the counterweight to the
        // `black-translucent` status bar above: installed, this document owns the
        // full screen, and without the inset the tab bar every admin page opens
        // with would sit behind the clock.
        className="admin-safe-shell min-h-full flex flex-col bg-bg text-fg"
        suppressHydrationWarning
      >
        <ImagesProvider data={data}>{children}</ImagesProvider>
      </body>
    </html>
  );
}
