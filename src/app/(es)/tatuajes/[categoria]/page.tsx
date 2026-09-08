import type { Metadata } from "next";
import { CategoryPage, categoryMetadata } from "@/components/CategoryPage";
import { CATEGORY_SLUGS } from "@/content/categories";

const locale = "es" as const;

type Params = { categoria: string };

/**
 * The set of subject pages is finite and known at build time, so pre-render
 * all of them. `dynamicParams` stays on its default (true) so an unknown slug
 * is still rendered on demand — and answers 404 from CategoryPage — rather
 * than being served the wrong page.
 */
export function generateStaticParams(): Params[] {
  return CATEGORY_SLUGS.map((categoria) => ({ categoria }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { categoria } = await params;
  return categoryMetadata(categoria, locale);
}

export default async function Categoria({
  params,
}: {
  params: Promise<Params>;
}) {
  const { categoria } = await params;
  return <CategoryPage slug={categoria} locale={locale} />;
}
