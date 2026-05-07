"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RemoteImage } from "@/components/RemoteImage";
import { AdminUploader } from "./AdminUploader";
import { AdminCategories } from "./AdminCategories";
import type { ImagesData, ImageWithSlug } from "@/lib/images-types";

type Props = { initialData: ImagesData };

type Tab = "images" | "categories";

export function AdminGallery({ initialData }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("images");
  const [filter, setFilter] = useState<string>("");
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
    // Order by categories.json `order`, with unknown cats at the end alpha.
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
    if (!filter) return grouped;
    const q = filter.toLowerCase();
    return grouped
      .map(([cat, imgs]) => [
        cat,
        imgs.filter(
          (i) =>
            i.slug.toLowerCase().includes(q) ||
            (i.alt ?? "").toLowerCase().includes(q),
        ),
      ] as const)
      .filter(([, imgs]) => imgs.length > 0);
  }, [grouped, filter]);

  const refresh = () => {
    startTransition(() => router.refresh());
  };

  return (
    <main className="flex-1 px-4 md:px-8 py-6 flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-4">
          <h1 className="font-serif italic text-2xl md:text-3xl">Admin</h1>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {allImages.length} images ·{" "}
            {initialData.categoriesData.categories.length} categories
          </span>
        </div>
        <div className="flex items-center gap-3">
          <form action="/api/admin/logout" method="post">
            <button
              type="submit"
              className="text-xs uppercase tracking-[0.2em] font-mono text-muted hover:text-fg"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <nav className="flex items-center gap-2 border-b border-line">
        {(["images", "categories"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs uppercase tracking-[0.2em] font-mono border-b-2 transition-colors ${
              tab === t
                ? "border-fg text-fg"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "images" ? (
        <>
          <AdminUploader
            categories={initialData.categoriesData.categories}
            onDone={refresh}
          />

          <div className="flex items-center gap-3">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by slug or alt"
              className="bg-transparent border border-line px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:border-fg"
            />
            {busy ? (
              <span className="text-xs font-mono text-muted">refreshing…</span>
            ) : null}
          </div>

          <section className="flex flex-col gap-10">
            {visibleGrouped.length === 0 ? (
              <p className="text-muted text-sm">No images yet.</p>
            ) : (
              visibleGrouped.map(([cat, imgs]) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  images={imgs}
                  categories={initialData.categoriesData.categories}
                  onChange={refresh}
                />
              ))
            )}
          </section>
        </>
      ) : (
        <AdminCategories
          categories={initialData.categoriesData.categories}
          onChange={refresh}
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
}: {
  category: string;
  images: ImageWithSlug[];
  categories: ImagesData["categoriesData"]["categories"];
  onChange: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          {category} · {images.length}
        </h2>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {images.map((img) => (
          <ImageCard
            key={img.slug}
            image={img}
            categories={categories}
            onChange={onChange}
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
}: {
  image: ImageWithSlug;
  categories: ImagesData["categoriesData"]["categories"];
  onChange: () => void;
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onChange();
      setOpen(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${image.slug}? This deletes the variants from R2.`)) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/images/${image.slug}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
        />
      </div>

      <div className="px-2 py-2 text-[10px] font-mono break-all">
        {image.slug}
      </div>

      {open ? (
        <div className="absolute inset-0 z-10 bg-bg/95 backdrop-blur-sm p-3 flex flex-col gap-2 text-xs">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 font-mono uppercase tracking-[0.2em] text-muted hover:text-fg"
          >
            ✕
          </button>
          <label className="flex flex-col gap-1">
            <span className="text-muted uppercase tracking-[0.2em] font-mono">
              Category
            </span>
            <select
              defaultValue={image.category ?? ""}
              onChange={(e) => patch({ category: e.target.value || null })}
              className="bg-transparent border border-line px-2 py-1"
            >
              <option value="">(none)</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.slug}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked={image.hidden ?? false}
              onChange={(e) => patch({ hidden: e.target.checked })}
            />
            <span>Hidden</span>
          </label>
          <button
            type="button"
            onClick={remove}
            className="mt-2 border border-red-400 text-red-400 px-2 py-1 uppercase tracking-[0.2em] font-mono text-[10px] hover:bg-red-400 hover:text-bg"
          >
            Delete
          </button>
          {err ? <span className="text-red-400">{err}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
