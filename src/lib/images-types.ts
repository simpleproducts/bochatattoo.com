/**
 * Shapes for the R2-hosted images data.
 *
 * Both files (manifest.json + categories.json) live at the root of the same
 * R2 bucket that serves the variant files, so the public images host CDN
 * fronts them too. The site reads them via images-store.ts (server-only,
 * cached + tag-revalidated). Admin actions write them back via the S3 SDK
 * and call revalidateTag('images').
 */

export type ImageFormat = "avif" | "webp" | "jpg";

export type ImageEntry = {
  alt: string;
  width: number;
  height: number;
  blurDataURL: string;
  /** Pre-rendered widths in pixels, ascending. */
  sizes: number[];
  format?: ImageFormat;
  category?: string;
  /** Hide from the site without deleting variants. */
  hidden?: boolean;
  /** ISO timestamp — set on creation, immutable. */
  createdAt?: string;
};

export type ImagesManifest = {
  version: 1;
  /** slug → entry */
  images: Record<string, ImageEntry>;
  /** Hand-picked slugs for the home Work strip, in order. */
  featuredSlugs: string[];
};

export type CategoryEntry = {
  slug: string;
  labels: { es: string; en: string };
  /** Lower order = earlier in the archive. */
  order: number;
  /** Hide from the archive (variants stay in R2). */
  hidden?: boolean;
};

export type CategoriesData = {
  version: 1;
  categories: CategoryEntry[];
};

export type ImageWithSlug = { slug: string } & ImageEntry;

export type ImagesData = {
  manifest: ImagesManifest;
  categoriesData: CategoriesData;
};

/** Shared empty fallbacks — used by both the public store and the admin S3 reader. */
export const EMPTY_MANIFEST: ImagesManifest = {
  version: 1,
  images: {},
  featuredSlugs: [],
};

export const EMPTY_CATEGORIES: CategoriesData = {
  version: 1,
  categories: [],
};
