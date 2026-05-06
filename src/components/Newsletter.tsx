"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Dictionary } from "@/i18n/types";

type State = "idle" | "loading" | "success" | "error";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          size?: "normal" | "compact" | "flexible";
          theme?: "light" | "dark" | "auto";
          execution?: "render" | "execute";
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (id?: string) => void;
      execute: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function Newsletter({ dict }: { dict: Dictionary["newsletter"] }) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — must stay empty
  const [state, setState] = useState<State>("idle");

  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Lazy-load Cloudflare Turnstile + render an invisible widget
  useEffect(() => {
    if (!SITE_KEY) return;
    if (typeof window === "undefined") return;

    let scriptEl = document.querySelector<HTMLScriptElement>(
      "script[data-turnstile]",
    );
    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      scriptEl.async = true;
      scriptEl.defer = true;
      scriptEl.dataset.turnstile = "1";
      document.head.appendChild(scriptEl);
    }

    let cancelled = false;
    const tryRender = () => {
      if (cancelled) return;
      if (!window.turnstile || !turnstileRef.current) {
        window.setTimeout(tryRender, 120);
        return;
      }
      if (widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: SITE_KEY!,
        // Modern Turnstile: "invisible" is gone. Use a flexible widget that
        // only renders visible UI when an interactive challenge is required,
        // and only runs the challenge when execute() is called on submit.
        size: "flexible",
        execution: "execute",
        appearance: "interaction-only",
        theme: "dark",
        callback: (token) => {
          tokenRef.current = token;
        },
        "error-callback": () => {
          tokenRef.current = null;
        },
        "expired-callback": () => {
          tokenRef.current = null;
        },
      });
    };
    tryRender();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
      }
      widgetIdRef.current = null;
      tokenRef.current = null;
    };
  }, []);

  async function getToken(): Promise<string | null> {
    if (!SITE_KEY) return null;
    if (!window.turnstile || !widgetIdRef.current) return null;
    window.turnstile.reset(widgetIdRef.current);
    window.turnstile.execute(widgetIdRef.current);
    return new Promise((resolve) => {
      const start = Date.now();
      const poll = window.setInterval(() => {
        if (tokenRef.current) {
          window.clearInterval(poll);
          resolve(tokenRef.current);
        } else if (Date.now() - start > 8000) {
          window.clearInterval(poll);
          resolve(null);
        }
      }, 100);
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "loading" || state === "success") return;
    setState("loading");
    try {
      const token = await getToken();
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, website, token }),
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
      className="w-full max-w-sm relative"
      aria-label={dict.label}
    >
      <span className="block font-mono text-[10px] uppercase tracking-[0.3em] text-muted mb-3">
        {dict.label}
      </span>

      <div
        className={`flex items-stretch transition-colors border ${
          state === "error"
            ? "border-red-500/50"
            : state === "success"
              ? "border-fg/40"
              : "border-fg/20 hover:border-fg/35 focus-within:border-fg/55"
        }`}
      >
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder={dict.placeholder}
          disabled={locked}
          aria-invalid={state === "error"}
          className="flex-1 min-w-0 bg-transparent px-4 py-3 text-sm text-fg placeholder:text-muted focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={locked || !email}
          aria-busy={state === "loading"}
          className={`shrink-0 px-4 border-l font-mono text-[10px] uppercase tracking-[0.3em] transition-colors ${
            state === "success"
              ? "bg-fg text-bg border-fg cursor-default"
              : state === "error"
                ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                : state === "loading"
                  ? "border-fg/20 text-muted cursor-wait"
                  : "border-fg/20 text-fg hover:bg-fg hover:text-bg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg disabled:cursor-not-allowed"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            {state === "loading" ? (
              <>
                <span className="block h-1 w-1 rounded-full bg-current animate-pulse" />
                <span className="block h-1 w-1 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
                <span className="block h-1 w-1 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
              </>
            ) : state === "success" ? (
              <>
                <span aria-hidden>✓</span>
                <span>OK</span>
              </>
            ) : (
              <>
                <span>{dict.submit}</span>
                <span aria-hidden>→</span>
              </>
            )}
          </span>
        </button>
      </div>

      {/* Honeypot — bots fill it, humans don't */}
      <label
        aria-hidden="true"
        className="absolute left-[-9999px] top-[-9999px] h-px w-px overflow-hidden"
      >
        Website
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>

      {/* Turnstile mounts here. With appearance="interaction-only" it stays
          empty unless Cloudflare flags the request and needs a challenge. */}
      <div ref={turnstileRef} aria-hidden="true" className="mt-3 empty:mt-0" />

      <p
        role="status"
        aria-live="polite"
        className={`mt-3 font-mono text-[10px] uppercase tracking-[0.3em] min-h-[1em] transition-colors ${
          state === "success"
            ? "text-fg"
            : state === "error"
              ? "text-red-400"
              : "text-muted"
        }`}
      >
        {state === "success"
          ? dict.success
          : state === "error"
            ? dict.error
            : " "}
      </p>
    </form>
  );
}
