import "@/app/globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ImagesProvider } from "@/components/ImagesProvider";
import { getImagesData } from "@/lib/images-store";

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

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const data = await getImagesData();
  return (
    <html
      lang="en"
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
