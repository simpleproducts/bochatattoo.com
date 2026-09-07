"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RemoteImage } from "@/components/RemoteImage";
import { AdminUploader } from "./AdminUploader";
import { AdminCategories } from "./AdminCategories";
import { AdminNav, type AdminTab } from "./AdminNav";
import { AdminLocaleSwitcher } from "./AdminLocaleSwitcher";
import { categoryLabel } from "./category-label";
import { readError } from "./read-error";
import type { ImagesData, ImageWithSlug } from "@/lib/images-types";
import type { Locale } from "@/i18n/config";
import type { AdminDictionary } from "@/i18n/admin";

type Props = {
  initialData: ImagesData;
  /** Which view to show. A URL concern now — the tab bar lives in AdminNav. */
  tab: Tab;
  /**
   * Both resolved by the page, on the server. The locale is only here for the
   * switcher — every word on this screen comes out of `dict`, so nothing below
   * ever has to branch on the language itself.
   */
  locale: Locale;
  dict: AdminDictionary;
};

type Tab = "images" | "categories";

const ALL = "__all__";

/**
 * The two halves of the header tally, resolved separately because the counts
 * move independently — a studio with one category and 143 images is ordinary,
 * and so is the reverse. Same one-is-the-only-irregular-count assumption the
 * calendar's counters make.
 */
function imageCount(n: number, dict: AdminDictionary): string {
  const template = n === 1 ? dict.gallery.imagesOne : dict.gallery.images;
  return template.replace("{count}", String(n));
}

function categoryCount(n: number, dict: AdminDictionary): string {
  const template =
    n === 1 ? dict.gallery.categoriesOne : dict.gallery.categories;
  return template.replace("{count}", String(n));
}

export function AdminGallery({ initialData, tab, locale, dict }: Props) {
  /*
   * The tab is a URL so the shared nav can link to it and so both views are
   * bookmarkable — but Images and Categories render from ONE payload this
   * component already has, so navigating between them would refetch the whole
   * manifest from R2 to show data already in memory. Local state drives the
   * render and history.replaceState keeps the URL honest without a round trip.
   * Seeded from the prop, and re-synced when a real navigation changes it.
   */
  const [view, setView] = useState<Tab>(tab);
  // React's documented "adjust state when a prop changes" pattern, run during
  // render rather than in an effect: an effect would paint the old tab once
  // before correcting it, and the lint rule that forbids it is right.
  const [servedTab, setServedTab] = useState<Tab>(tab);
  if (servedTab !== tab) {
    setServedTab(tab);
    setView(tab);
  }

  const selectTab = (next: Exclude<AdminTab, "calendar">) => {
    setView(next);
    const url = next === "categories" ? "/admin/gallery?tab=categories" : "/admin/gallery";
    window.history.replaceState(null, "", url);
  };
  const router = useRouter();
  const [filter, setFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [busy, startTransition] = useTransition();

  const allImages: ImageWithSlug[] = useMemo(
    () =>
      Object.entries(initialData.manifest.images).map(([slug, e]) => ({
        slug,
        ...e,
      })),
    [initialData],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ImageWithSlug[]>();
    for (const img of allImages) {
      const cat = img.category ?? "uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(img);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.slug.localeCompare(b.slug));
    }
    const known = new Map(
      initialData.categoriesData.categories.map((c) => [c.slug, c.order]),
    );
    return Array.from(map.entries()).sort((a, b) => {
      const oa = known.get(a[0]);
      const ob = known.get(b[0]);
      if (oa !== undefined && ob !== undefined) return oa - ob;
      if (oa !== undefined) return -1;
      if (ob !== undefined) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [allImages, initialData.categoriesData.categories]);

  const visibleGrouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return grouped
      .filter(([cat]) => categoryFilter === ALL || cat === categoryFilter)
      .map(([cat, imgs]) => {
        if (!q) return [cat, imgs] as const;
        const next = imgs.filter(
          (i) =>
            i.slug.toLowerCase().includes(q) ||
            (i.alt ?? "").toLowerCase().includes(q),
        );
        return [cat, next] as const;
      })
      .filter(([, imgs]) => imgs.length > 0);
  }, [grouped, filter, categoryFilter]);

  const refresh = () => {
    startTransition(() => router.refresh());
  };

  return (
    <main className="flex-1 px-4 md:px-8 py-6 flex flex-col gap-6">
      <AdminNav active={view} dict={dict} onSelectTab={selectTab} />

      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-4">
          <h1 className="font-serif italic text-2xl md:text-3xl">
            {dict.common.admin}
          </h1>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {dict.gallery.counts
              .replace("{images}", imageCount(allImages.length, dict))
              .replace(
                "{categories}",
                categoryCount(
                  initialData.categoriesData.categories.length,
                  dict
                )
              )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <AdminLocaleSwitcher locale={locale} label={dict.common.language} />
          <form action="/api/admin/logout" method="post">
            <button
              type="submit"
              className="text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg cursor-pointer"
            >
              {dict.common.signOut}
            </button>
          </form>
        </div>
      </header>

      {view === "images" ? (
        <>
          <AdminUploader
            categories={initialData.categoriesData.categories}
            onDone={refresh}
            dict={dict}
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-mono uppercase tracking-[0.2em] text-muted">
                {dict.common.category}
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent border border-line px-2 py-2 cursor-pointer"
              >
                <option value={ALL}>{dict.gallery.allCategories}</option>
                {[...initialData.categoriesData.categories]
                  .sort((a, b) =>
                    categoryLabel(a).localeCompare(categoryLabel(b)),
                  )
                  .map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                {/* "uncategorized" pseudo-bucket — only show if any image has no category */}
                {allImages.some((i) => !i.category) ? (
                  <option value="uncategorized">
                    {dict.gallery.uncategorized}
                  </option>
                ) : null}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs flex-1 min-w-[200px]">
              <span className="font-mono uppercase tracking-[0.2em] text-muted">
                {dict.common.search}
              </span>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={dict.gallery.searchPlaceholder}
                className="bg-transparent border border-line px-3 py-2 text-sm focus:outline-none focus:border-fg"
              />
            </label>
            {busy ? (
              <span className="text-xs font-mono text-muted self-end pb-2">
                {dict.common.refreshing}
              </span>
            ) : null}
          </div>

          <section className="flex flex-col gap-10">
            {visibleGrouped.length === 0 ? (
              <p className="text-muted text-sm">{dict.gallery.noMatch}</p>
            ) : (
              visibleGrouped.map(([cat, imgs]) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  images={imgs}
                  categories={initialData.categoriesData.categories}
                  onChange={refresh}
                  dict={dict}
                />
              ))
            )}
          </section>
        </>
      ) : (
        <AdminCategories
          categories={initialData.categoriesData.categories}
          onChange={refresh}
          dict={dict}
        />
      )}
    </main>
  );
}

function CategorySection({
  category,
  images,
  categories,
  onChange,
  dict,
}: {
  category: string;
  images: ImageWithSlug[];
  categories: ImagesData["categoriesData"]["categories"];
  onChange: () => void;
  dict: AdminDictionary;
}) {
  const entry = categories.find((c) => c.slug === category);
  // Category names are the owner's own data and stay as she typed them. Only
  // the two fallbacks are ours: the "uncategorized" pseudo-bucket, which is a
  // word this component invented rather than a slug she can rename, and a slug
  // whose category row is gone — that one still reads as itself.
  const label = entry
    ? categoryLabel(entry)
    : category === "uncategorized"
    ? dict.gallery.uncategorized
    : category.replace(/-/g, " ");
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          {label} · {images.length}
        </h2>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {images.map((img) => (
          <ImageCard
            key={img.slug}
            image={img}
            categories={categories}
            onChange={onChange}
            dict={dict}
          />
        ))}
      </div>
    </div>
  );
}

function ImageCard({
  image,
  categories,
  onChange,
  dict,
}: {
  image: ImageWithSlug;
  categories: ImagesData["categoriesData"]["categories"];
  onChange: () => void;
  dict: AdminDictionary;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/images/${image.slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res));
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(dict.gallery.confirmDelete.replace("{slug}", image.slug))) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/images/${image.slug}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res));
      onChange();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      className={`relative bg-line ${image.hidden ? "opacity-50" : ""} ${busy ? "pointer-events-none" : ""}`}
    >
      <div
        className="relative w-full aspect-square overflow-hidden cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <RemoteImage
          slug={image.slug}
          alt={image.alt}
          fill
          sizes="(min-width: 1024px) 16vw, (min-width: 768px) 25vw, 50vw"
          className="object-cover"
          showHidden
        />
        {image.hidden ? (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-bg/80 text-fg font-mono uppercase tracking-[0.2em] text-[9px]">
            {dict.common.hidden}
          </span>
        ) : null}
      </div>

      <div className="px-2 py-2 text-[10px] font-mono break-all">
        {image.slug}
      </div>

      {open ? (
        <div className="absolute inset-0 z-10 bg-bg/95 backdrop-blur-sm p-4 pt-12 flex flex-col gap-3 text-xs">
          <button
            type="button"
            aria-label={dict.common.close}
            onClick={() => setOpen(false)}
            className="absolute top-1 right-1 w-9 h-9 flex items-center justify-center text-2xl leading-none text-muted hover:text-fg cursor-pointer"
          >
            ×
          </button>
          <label className="flex flex-col gap-1">
            <span className="text-muted uppercase tracking-[0.2em] font-mono">
              {dict.common.category}
            </span>
            <select
              defaultValue={image.category ?? ""}
              onChange={(e) => patch({ category: e.target.value || null })}
              className="bg-transparent border border-line px-2 py-1 cursor-pointer"
            >
              <option value="">{dict.gallery.noCategory}</option>
              {[...categories]
                .sort((a, b) =>
                  categoryLabel(a).localeCompare(categoryLabel(b)),
                )
                .map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {categoryLabel(c)}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={image.hidden ?? false}
              onChange={(e) => patch({ hidden: e.target.checked })}
              className="cursor-pointer"
            />
            <span>{dict.common.hidden}</span>
          </label>
          <button
            type="button"
            onClick={remove}
            className="mt-2 border border-red-400 text-red-400 px-2 py-1 uppercase tracking-[0.2em] font-mono text-[10px] hover:bg-red-400 hover:text-bg cursor-pointer"
          >
            {dict.common.delete}
          </button>
          {err ? (
            <span className="text-red-400 break-words">{err}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
