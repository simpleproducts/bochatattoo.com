import "@/app/globals.css";
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Admin · Bocha Tattoo",
  robots: { index: false, follow: false },
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
        className="min-h-full flex flex-col bg-bg text-fg"
        suppressHydrationWarning
      >
        <ImagesProvider data={data}>{children}</ImagesProvider>
      </body>
    </html>
  );
}
