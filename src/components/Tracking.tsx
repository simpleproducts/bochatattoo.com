"use client";
import Script from "next/script";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const META_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Public-site analytics: Google Analytics 4 + Meta Pixel.
 * - Loads each script with `next/script` (afterInteractive — doesn't block paint)
 * - Each is opt-in: missing env var = no script injected
 * - Fires page_view on every client-side navigation (SPA aware)
 *
 * Env vars (all NEXT_PUBLIC_, ship to the browser):
 *   NEXT_PUBLIC_GA_MEASUREMENT_ID    e.g. "G-XXXXXXXXXX"
 *   NEXT_PUBLIC_META_PIXEL_ID        e.g. "1234567890123456"
 */
export function Tracking() {
  return (
    <>
      {GA_ID ? <GoogleAnalytics id={GA_ID} /> : null}
      {META_ID ? <MetaPixel id={META_ID} /> : null}
      {(GA_ID || META_ID) ? (
        <Suspense fallback={null}>
          <PageviewTracker ga={GA_ID} pixel={META_ID} />
        </Suspense>
      ) : null}
    </>
  );
}

function GoogleAnalytics({ id }: { id: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${id}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}

function MetaPixel({ id }: { id: string }) {
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${id}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height={1}
          width={1}
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}

/**
 * Client-side route-change tracker. App Router doesn't trigger full page
 * reloads on internal navigation, so the auto-fire from gtag.js / fbevents.js
 * only sees the initial load. We forward each new path to both providers.
 *
 * Suspense boundary in `<Tracking>` is required because `useSearchParams`
 * opts the route into dynamic rendering otherwise.
 */
function PageviewTracker({
  ga,
  pixel,
}: {
  ga: string | undefined;
  pixel: string | undefined;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const qs = searchParams?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (ga && typeof window.gtag === "function") {
      window.gtag("event", "page_view", { page_path: url });
    }
    if (pixel && typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  }, [pathname, searchParams, ga, pixel]);

  return null;
}
