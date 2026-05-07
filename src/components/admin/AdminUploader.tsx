"use client";
import { useRef, useState } from "react";
import type { CategoryEntry } from "@/lib/images-types";

type Props = { categories: CategoryEntry[]; onDone: () => void };

type Status = "idle" | "uploading" | "processing" | "done" | "error";

type Item = {
  file: File;
  status: Status;
  message?: string;
  slug?: string;
};

const MAX_BYTES = 50 * 1024 * 1024;

export function AdminUploader({ categories, onDone }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>(categories[0]?.slug ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!category) {
      alert("Pick a category first.");
      return;
    }
    const next: Item[] = Array.from(files).map((file) => {
      if (file.size > MAX_BYTES) {
        return {
          file,
          status: "error" as const,
          message: `too-large (${(file.size / 1_000_000).toFixed(1)} MB > 50 MB)`,
        };
      }
      return { file, status: "idle" as const };
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

  return (
    <section className="border border-line p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-mono uppercase tracking-[0.2em] text-muted">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-transparent border border-line px-2 py-1"
          >
            {categories.length === 0 ? (
              <option value="">(create a category first)</option>
            ) : (
              categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.slug}
                </option>
              ))
            )}
          </select>
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/tiff"
          multiple
          disabled={running || !category}
          onChange={(e) => {
            void handleFiles(e.target.files);
            // Reset so picking the same files again works.
            e.target.value = "";
          }}
          className="text-xs"
        />
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs font-mono">
          {items.map((it, i) => (
            <li
              key={`${it.file.name}-${i}`}
              className="flex items-center gap-3"
            >
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
              <span className="flex-1 truncate">{it.file.name}</span>
              {it.slug ? <span className="text-muted">{it.slug}</span> : null}
              {it.message ? (
                <span className="text-red-400">{it.message}</span>
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
    // 1) ask the server for a presigned URL
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

    // 2) PUT the file directly to R2
    const putRes = await fetch(init.putUrl, {
      method: "PUT",
      headers: { "content-type": file.type || "image/jpeg" },
      body: file,
    });
    if (!putRes.ok) {
      return { status: "error", message: `put: ${putRes.status}`, slug: init.slug };
    }

    // 3) ask the server to process + register
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
