"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type {
  CategoryEntry,
  ImageEntry,
  ImageWithSlug,
  ImagesData,
} from "@/lib/images-types";
import { HIDDEN_SLUGS } from "@/data/hidden-slugs";

type Ctx = {
  images: Record<string, ImageEntry>;
  categories: CategoryEntry[];
  featuredSlugs: string[];
  hiddenSet: Set<string>;
};

const ImagesContext = createContext<Ctx | null>(null);

export function ImagesProvider({
  data,
  children,
}: {
  data: ImagesData;
  children: ReactNode;
}) {
  const value = useMemo<Ctx>(() => {
    const hiddenSet = new Set<string>(HIDDEN_SLUGS);
    for (const [slug, entry] of Object.entries(data.manifest.images)) {
      if (entry.hidden) hiddenSet.add(slug);
    }
    return {
      images: data.manifest.images,
      categories: data.categoriesData.categories,
      featuredSlugs: data.manifest.featuredSlugs,
      hiddenSet,
    };
  }, [data]);
  return (
    <ImagesContext.Provider value={value}>{children}</ImagesContext.Provider>
  );
}

const EMPTY_HIDDEN = new Set<string>();

function useImagesContext(): Ctx {
  const ctx = useContext(ImagesContext);
  if (!ctx) {
    return {
      images: {},
      categories: [],
      featuredSlugs: [],
      hiddenSet: EMPTY_HIDDEN,
    };
  }
  return ctx;
}

export function useImage(slug: string): ImageEntry | undefined {
  const { images, hiddenSet } = useImagesContext();
  if (hiddenSet.has(slug)) return undefined;
  return images[slug];
}

/** Whole map for callbacks that need arbitrary slug lookup (e.g. preload). */
export function useImagesMap(): {
  images: Record<string, ImageEntry>;
  hiddenSet: Set<string>;
} {
  const { images, hiddenSet } = useImagesContext();
  return { images, hiddenSet };
}

export function useCategories(): CategoryEntry[] {
  return useImagesContext().categories;
}

export function useFeaturedSlugs(): string[] {
  return useImagesContext().featuredSlugs;
}

export function useImagesByCategory(category: string): ImageWithSlug[] {
  const { images, hiddenSet } = useImagesContext();
  return Object.entries(images)
    .filter(([slug, e]) => e.category === category && !hiddenSet.has(slug))
    .map(([slug, e]) => ({ slug, ...e }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function useAllImages(): ImageWithSlug[] {
  const { images, hiddenSet } = useImagesContext();
  return Object.entries(images)
    .filter(([slug]) => !hiddenSet.has(slug))
    .map(([slug, e]) => ({ slug, ...e }));
}
