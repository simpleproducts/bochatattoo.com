"use client";
import { useState, type FormEvent } from "react";
import type { Dictionary } from "@/i18n/types";

type State = "idle" | "loading" | "success" | "error";

export function Newsletter({ dict }: { dict: Dictionary["newsletter"] }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "loading" || state === "success") return;
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setState("success");
    } catch {
      setState("error");
    }
  }

  const locked = state === "loading" || state === "success";

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm"
      aria-label={dict.label}
    >
      <span className="block font-mono text-[10px] uppercase tracking-[0.3em] text-muted mb-2">
        {dict.label}
      </span>
      <div className="flex items-center gap-3 border-b border-line focus-within:border-fg transition-colors">
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={dict.placeholder}
          disabled={locked}
          aria-invalid={state === "error"}
          className="flex-1 bg-transparent py-2 text-sm placeholder:text-muted/60 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={locked || !email}
          className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted hover:text-fg transition-colors disabled:opacity-40 disabled:hover:text-muted py-2"
        >
          {state === "loading" ? "…" : `${dict.submit} →`}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 font-mono text-[10px] uppercase tracking-[0.3em] min-h-[1em] ${
          state === "success" ? "text-fg/80" : "text-fg/70"
        }`}
      >
        {state === "success" ? dict.success : state === "error" ? dict.error : " "}
      </p>
    </form>
  );
}
