import type { NextConfig } from "next";

const IMAGES_HOST = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? "https://images.bochatattoo.com",
    ).origin;
  } catch {
    return "https://images.bochatattoo.com";
  }
})();

/**
 * Content-Security-Policy — drawn up against every external host the site
 * actually talks to. Tweak with care; missing a host here will silently
 * break a feature.
 *
 * Hosts included:
 *  - Vercel Analytics: va.vercel-scripts.com, *.vercel-insights.com
 *  - Google Analytics 4: googletagmanager.com, google-analytics.com,
 *      *.analytics.google.com, stats.g.doubleclick.net
 *  - Meta Pixel: connect.facebook.net (script), facebook.com/tr (beacon)
 *  - Cloudflare Turnstile (newsletter): challenges.cloudflare.com
 *  - R2 images: ${IMAGES_HOST}
 *  - R2 presigned PUT (admin uploads): *.r2.cloudflarestorage.com
 */
function buildCSP(): string {
  return [
    "default-src 'self'",
    [
      "script-src 'self'",
      // Next.js + tracking inline init scripts
      "'unsafe-inline'",
      "'unsafe-eval'",
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
      "https://connect.facebook.net",
      "https://va.vercel-scripts.com",
      "https://challenges.cloudflare.com",
    ].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    [
      "img-src 'self' data: blob:",
      IMAGES_HOST,
      "https://www.facebook.com",
      "https://www.google-analytics.com",
      "https://*.analytics.google.com",
      "https://stats.g.doubleclick.net",
    ].join(" "),
    [
      "connect-src 'self'",
      IMAGES_HOST,
      "https://*.r2.cloudflarestorage.com",
      "https://www.google-analytics.com",
      "https://*.analytics.google.com",
      "https://stats.g.doubleclick.net",
      "https://va.vercel-scripts.com",
      "https://*.vercel-insights.com",
      "https://challenges.cloudflare.com",
      "https://api.brevo.com",
    ].join(" "),
    "frame-src 'self' https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: buildCSP() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  images: {
    // Variants are pre-generated to 640/1280/2560 AVIF+WebP and served straight
    // from R2. Disabling Next's optimizer avoids re-encoding already-optimized
    // files and burning the Vercel image-optimization quota.
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
