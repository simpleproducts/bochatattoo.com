import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Variants are pre-generated to 640/1280/2560 AVIF+WebP and served straight
    // from R2. Disabling Next's optimizer avoids re-encoding already-optimized
    // files and burning the Vercel image-optimization quota.
    unoptimized: true,
  },
};

export default nextConfig;
