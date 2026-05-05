"use client";
import { useEffect, useState } from "react";

export function PageCurtain() {
  const [lifted, setLifted] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGone(true);
      return;
    }
    const r = requestAnimationFrame(() => setLifted(true));
    const t = setTimeout(() => setGone(true), 1200);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[300] bg-bg pointer-events-none transition-transform duration-[900ms] ease-[cubic-bezier(.76,0,.24,1)] flex items-center justify-center ${
        lifted ? "-translate-y-full" : ""
      }`}
    >
      <span className="font-serif italic text-fg/40 text-2xl tracking-tight curtain-mark">
        bocha
      </span>
    </div>
  );
}
