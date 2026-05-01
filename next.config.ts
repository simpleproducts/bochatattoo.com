import type { NextConfig } from "next";

const imagesBase = process.env.NEXT_PUBLIC_IMAGES_BASE_URL;
const imagesHost = imagesBase ? new URL(imagesBase).hostname : undefined;

const nextConfig: NextConfig = {
  images: {
    // We pre-generate sized AVIF/WebP variants and serve them straight from R2.
    // Disable Vercel's optimizer so we don't burn the Hobby quota on already-optimized files.
    unoptimized: true,
    remotePatterns: imagesHost
      ? [{ protocol: "https", hostname: imagesHost }]
      : [],
  },
};

export default nextConfig;
