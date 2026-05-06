import { getImage, imageUrl } from "@/lib/images";
import type { CSSProperties } from "react";

const BASE = process.env.NEXT_PUBLIC_IMAGES_BASE_URL ?? "";

type Props = {
  slug: string;
  alt?: string;
  /** Responsive sizes hint — controls which srcSet entry the browser picks. */
  sizes?: string;
  className?: string;
  /** Eager-load with `fetchpriority=high`. Use only for above-the-fold / LCP. */
  priority?: boolean;
  /**
   * Fine-grained network priority hint. Defaults to "high" when `priority`
   * is true, otherwise unset. Pass "low" to deprioritize images that are
   * definitely below the fold (frees bandwidth for critical resources).
   */
  fetchPriority?: "high" | "low" | "auto";
  fill?: boolean;
  style?: CSSProperties;
};

/**
 * Plain <img> with a manually-built srcSet. We bypass next/image because
 * `unoptimized: true` in next.config makes Next ignore the custom loader,
 * which broke the URL resolution. With this component, every URL in the
 * srcSet is stamped with NEXT_PUBLIC_IMAGES_BASE_URL at render — no Next
 * loader, no Vercel optimizer dependency, just R2 → browser.
 */
export function RemoteImage({
  slug,
  alt,
  sizes = "100vw",
  className,
  priority,
  fetchPriority,
  fill,
  style,
}: Props) {
  const entry = getImage(slug);

  if (!entry || !BASE) {
    return (
      <div
        className={`relative bg-line text-muted text-[10px] uppercase tracking-[0.2em] font-mono flex items-end p-3 ${className ?? ""}`}
        style={{ aspectRatio: "3 / 4", ...style }}
      >
        {!BASE ? `No images host: ${slug}` : `Missing: ${slug}`}
      </div>
    );
  }

  const format = entry.format ?? "avif";
  const srcSet = entry.sizes
    .map((w) => `${imageUrl(slug, w, format)} ${w}w`)
    .join(", ");
  const largest = entry.sizes[entry.sizes.length - 1];
  const fallbackSrc = imageUrl(slug, largest, format);

  const baseClass = fill
    ? `absolute inset-0 w-full h-full ${className ?? ""}`
    : className ?? "";

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={fallbackSrc}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt ?? entry.alt}
      loading={priority ? undefined : "lazy"}
      decoding="async"
      fetchPriority={fetchPriority ?? (priority ? "high" : undefined)}
      width={fill ? undefined : entry.width}
      height={fill ? undefined : entry.height}
      className={baseClass}
      style={{
        backgroundImage: `url("${entry.blurDataURL}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        ...style,
      }}
    />
  );
}
