import "@/app/globals.css";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Cursor } from "./Cursor";
import { Grain } from "./Grain";
import { PageCurtain } from "./PageCurtain";
import { Tracking } from "./Tracking";

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
 * Shared <html>/<body> shell rendered by each locale's root layout. The lang
 * attribute is set statically per route group so we don't need a client-side
 * patch (HtmlLang) and don't need suppressHydrationWarning anywhere.
 */
export function RootShell({
  lang,
  children,
}: {
  lang: "es" | "en";
  children: React.ReactNode;
}) {
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-bg text-fg"
        // Grammarly / LanguageTool / other extensions inject attributes
        // (data-new-gr-c-s-check-loaded, data-gr-ext-installed, etc.) onto
        // <body> before React hydrates. There is nothing in our own tree
        // that mismatches — this just silences the third-party noise.
        suppressHydrationWarning
      >
        <PageCurtain />
        {children}
        <Grain />
        <Cursor />
        <Tracking />
      </body>
    </html>
  );
}
