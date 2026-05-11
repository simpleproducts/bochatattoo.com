"use client";
import { useEffect, useRef, useState } from "react";
import type { CategoryEntry } from "@/lib/images-types";
import { categoryLabel } from "./category-label";

type Props = { categories: CategoryEntry[]; onDone: () => void };

type Status = "idle" | "uploading" | "processing" | "done" | "error";

type Item = {
  file: File;
  status: Status;
  message?: string;
  slug?: string;
  previewUrl?: string;
};

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/tiff";

export function AdminUploader({ categories, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>(categories[0]?.slug ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Revoke any object URLs from the previous batch when the items list is
  // replaced or the component unmounts. Without this, blob URLs leak.
  useEffect(() => {
    return () => {
      for (const it of items) {
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      }
    };
  }, [items]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!category) {
      alert("Pick a category first.");
      return;
    }
    const next: Item[] = Array.from(files).map((file) => {
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined;
      if (file.size > MAX_BYTES) {
        return {
          file,
          previewUrl,
          status: "error" as const,
          message: `too-large (${(file.size / 1_000_000).toFixed(1)} MB > 50 MB)`,
        };
      }
      return { file, previewUrl, status: "idle" as const };
    });
    setItems(next);
    setRunning(true);

    let i = 0;
    for (const item of next) {
      if (item.status !== "error") {
        const updated = await uploadOne(item.file, category);
        next[i] = { ...item, ...updated };
        setItems([...next]);
      }
      i++;
    }
    setRunning(false);
    onDone();
  }

  const disabled = running || !category;

  return (
    <section className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs max-w-xs">
        <span className="font-mono uppercase tracking-[0.2em] text-muted">
          Upload to category
        </span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-transparent border border-line px-2 py-2 cursor-pointer"
        >
          {categories.length === 0 ? (
            <option value="">(create a category first)</option>
          ) : (
            [...categories]
              .sort((a, b) =>
                categoryLabel(a).localeCompare(categoryLabel(b)),
              )
              .map((c) => (
                <option key={c.slug} value={c.slug}>
                  {categoryLabel(c)}
                </option>
              ))
          )}
        </select>
      </label>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={[
          "border-2 border-dashed rounded-md p-10 flex flex-col items-center justify-center gap-3 text-center transition-colors",
          disabled
            ? "border-line opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:border-fg hover:bg-fg/5",
          dragOver ? "border-fg bg-fg/10" : "border-line",
        ].join(" ")}
      >
        <div className="text-3xl leading-none">↑</div>
        <div className="font-serif italic text-xl">
          {dragOver ? "Drop to upload" : "Drag images here"}
        </div>
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted">
          or click to choose files
        </div>
        <div className="text-[10px] font-mono text-muted/70">
          jpg · png · webp · avif · heic · tiff — up to 50 MB each · multi-select OK
        </div>
        {!category ? (
          <div className="text-xs text-red-400 font-mono mt-2">
            Pick a category above first
          </div>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          disabled={disabled}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2 text-xs font-mono">
          {items.map((it, i) => (
            <li
              key={`${it.file.name}-${i}`}
              className="flex items-center gap-3 border border-line p-2"
            >
              {it.previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={it.previewUrl}
                  alt=""
                  className="w-10 h-10 object-cover bg-line shrink-0"
                />
              ) : (
                <div className="w-10 h-10 bg-line shrink-0" />
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="truncate">{it.file.name}</span>
                <span className="text-muted">
                  {(it.file.size / 1_000_000).toFixed(1)} MB
                  {it.slug ? ` · ${it.slug}` : ""}
                </span>
              </div>
              <span
                className={
                  it.status === "error"
                    ? "text-red-400"
                    : it.status === "done"
                      ? "text-fg"
                      : "text-muted"
                }
              >
                [{it.status}]
              </span>
              {it.message ? (
                <span className="text-red-400 text-[10px] max-w-[40%] break-words">
                  {it.message}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

async function uploadOne(
  file: File,
  category: string,
): Promise<Partial<Item>> {
  try {
    const initRes = await fetch("/api/admin/upload-init", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "image/jpeg",
        category,
      }),
    });
    if (!initRes.ok) {
      const t = await initRes.text();
      return { status: "error", message: `init: ${t}` };
    }
    const init = (await initRes.json()) as {
      slug: string;
      key: string;
      ext: string;
      putUrl: string;
    };

    const putRes = await fetch(init.putUrl, {
      method: "PUT",
      headers: { "content-type": file.type || "image/jpeg" },
      body: file,
    });
    if (!putRes.ok) {
      return {
        status: "error",
        message: `put: ${putRes.status}`,
        slug: init.slug,
      };
    }

    const finalRes = await fetch("/api/admin/upload-finalize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: init.slug,
        ext: init.ext,
        category,
        alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
      }),
    });
    if (!finalRes.ok) {
      const t = await finalRes.text();
      return { status: "error", message: `finalize: ${t}`, slug: init.slug };
    }
    return { status: "done", slug: init.slug };
  } catch (e) {
    return { status: "error", message: (e as Error).message };
  }
}
