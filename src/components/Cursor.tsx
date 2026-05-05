"use client";
import { useEffect, useRef } from "react";

/**
 * Minimal custom cursor: one small filled dot, 1:1 tracking (no smoothing lag).
 * On hover over a, button, or [data-cursor], it morphs into a hollow ring.
 * Disabled on touch and prefers-reduced-motion.
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      el.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    };

    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const interactive = !!t?.closest("a, button, [data-cursor]");
      ref.current?.classList.toggle("is-active", interactive);
    };

    document.documentElement.classList.add("custom-cursor");
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      document.documentElement.classList.remove("custom-cursor");
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="cursor-mark pointer-events-none fixed left-0 top-0 z-[100] mix-blend-difference"
      // Start off-screen so the (0,0) corner dot never appears before the first mousemove.
      style={{ transform: "translate3d(-100px, -100px, 0)" }}
    />
  );
}
