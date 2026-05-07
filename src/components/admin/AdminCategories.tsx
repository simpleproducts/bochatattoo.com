"use client";
import { useState } from "react";
import type { CategoryEntry } from "@/lib/images-types";

type Props = { categories: CategoryEntry[]; onChange: () => void };

export function AdminCategories({ categories, onChange }: Props) {
  return (
    <section className="flex flex-col gap-6">
      <NewCategoryForm onCreated={onChange} />

      <div className="flex flex-col gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Categories
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-[0.2em] font-mono text-muted">
              <tr className="border-b border-line">
                <th className="text-left py-2 pr-3">Slug</th>
                <th className="text-left py-2 pr-3">ES</th>
                <th className="text-left py-2 pr-3">EN</th>
                <th className="text-left py-2 pr-3">Order</th>
                <th className="text-left py-2 pr-3">Hidden</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...categories]
                .sort((a, b) => a.order - b.order)
                .map((c) => (
                  <CategoryRow
                    key={c.slug}
                    category={c}
                    onChange={onChange}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function NewCategoryForm({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState("");
  const [es, setEs] = useState("");
  const [en, setEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, labels: { es, en } }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      setSlug("");
      setEs("");
      setEn("");
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border border-line p-4 flex flex-col md:flex-row md:items-end gap-3"
    >
      <label className="flex flex-col gap-1 text-xs flex-1">
        <span className="font-mono uppercase tracking-[0.2em] text-muted">
          New slug
        </span>
        <input
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="best-tattoos"
          className="bg-transparent border border-line px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs flex-1">
        <span className="font-mono uppercase tracking-[0.2em] text-muted">
          ES label
        </span>
        <input
          value={es}
          onChange={(e) => setEs(e.target.value)}
          className="bg-transparent border border-line px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs flex-1">
        <span className="font-mono uppercase tracking-[0.2em] text-muted">
          EN label
        </span>
        <input
          value={en}
          onChange={(e) => setEn(e.target.value)}
          className="bg-transparent border border-line px-2 py-1"
        />
      </label>
      <button
        type="submit"
        disabled={busy || !slug || (!es && !en)}
        className="border border-fg px-3 py-1 text-xs uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors disabled:opacity-40"
      >
        Add
      </button>
      {err ? <span className="text-red-400 text-xs">{err}</span> : null}
    </form>
  );
}

function CategoryRow({
  category,
  onChange,
}: {
  category: CategoryEntry;
  onChange: () => void;
}) {
  const [draft, setDraft] = useState(category);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty =
    draft.labels.es !== category.labels.es ||
    draft.labels.en !== category.labels.en ||
    draft.order !== category.order ||
    Boolean(draft.hidden) !== Boolean(category.hidden);

  async function patch() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/categories/${encodeURIComponent(category.slug)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            labels: draft.labels,
            order: draft.order,
            hidden: Boolean(draft.hidden),
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete category "${category.slug}"?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/categories/${encodeURIComponent(category.slug)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message ?? `HTTP ${res.status}`);
      }
      onChange();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-line align-top">
      <td className="py-2 pr-3 font-mono text-xs">{category.slug}</td>
      <td className="py-2 pr-3">
        <input
          value={draft.labels.es}
          onChange={(e) =>
            setDraft({ ...draft, labels: { ...draft.labels, es: e.target.value } })
          }
          className="bg-transparent border border-line px-2 py-1 w-full"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          value={draft.labels.en}
          onChange={(e) =>
            setDraft({ ...draft, labels: { ...draft.labels, en: e.target.value } })
          }
          className="bg-transparent border border-line px-2 py-1 w-full"
        />
      </td>
      <td className="py-2 pr-3 w-20">
        <input
          type="number"
          value={draft.order}
          onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })}
          className="bg-transparent border border-line px-2 py-1 w-16"
        />
      </td>
      <td className="py-2 pr-3">
        <input
          type="checkbox"
          checked={Boolean(draft.hidden)}
          onChange={(e) => setDraft({ ...draft, hidden: e.target.checked })}
        />
      </td>
      <td className="py-2 pr-3 flex items-center gap-2">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={patch}
          className="border border-fg px-2 py-1 text-[10px] uppercase tracking-[0.2em] font-mono hover:bg-fg hover:text-bg transition-colors disabled:opacity-30"
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="border border-red-400 text-red-400 px-2 py-1 text-[10px] uppercase tracking-[0.2em] font-mono hover:bg-red-400 hover:text-bg disabled:opacity-30"
        >
          Delete
        </button>
        {err ? <span className="text-red-400 text-xs">{err}</span> : null}
      </td>
    </tr>
  );
}
