import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Cursor } from "@/components/Cursor";
import { Grain } from "@/components/Grain";
import { PageCurtain } from "@/components/PageCurtain";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

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

// Per-page metadata (title, description, alternates, og) lives in each route's
// page.tsx. Only the resolution base belongs at the root.
export const metadata: Metadata = {
  metadataBase: new URL("https://bochatattoo.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-bg text-fg"
        suppressHydrationWarning
      >
        <PageCurtain />
        {children}
        <Grain />
        <Cursor />
        <Analytics />
      </body>
    </html>
  );
}
