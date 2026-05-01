import Image, { type ImageProps } from "next/image";
import { getImage, imageUrl, pickSize } from "@/lib/images";

type Props = {
  slug: string;
  /** Override alt; defaults to manifest entry. */
  alt?: string;
  /** Responsive sizes hint forwarded to next/image. Default: full-width. */
  sizes?: string;
  className?: string;
  priority?: boolean;
  fill?: boolean;
} & Pick<ImageProps, "style">;

export function RemoteImage({
  slug,
  alt,
  sizes = "100vw",
  className,
  priority,
  fill,
  style,
}: Props) {
  const entry = getImage(slug);

  if (!entry) {
    // Manifest entry missing — render a labelled box so the layout still works.
    return (
      <div
        className={`relative bg-line text-muted text-[10px] uppercase tracking-[0.2em] font-mono flex items-end p-3 ${className ?? ""}`}
        style={{ aspectRatio: "3 / 4", ...style }}
      >
        Missing: {slug}
      </div>
    );
  }

  const loader = ({ width }: { src: string; width: number; quality?: number }) => {
    const chosen = pickSize(entry.sizes, width);
    return imageUrl(slug, chosen, entry.format ?? "avif");
  };

  const common = {
    loader,
    src: slug,
    alt: alt ?? entry.alt,
    sizes,
    placeholder: "blur" as const,
    blurDataURL: entry.blurDataURL,
    className,
    priority,
    style,
  };

  if (fill) return <Image {...common} fill />;
  return <Image {...common} width={entry.width} height={entry.height} />;
}
