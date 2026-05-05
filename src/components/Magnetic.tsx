"use client";
import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** 0–1, how much the element follows the cursor */
  strength?: number;
  /** distance in px around the element where the magnet is "live" */
  range?: number;
};

export function Magnetic({
  children,
  className = "",
  strength = 0.3,
  range = 80,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      const max = Math.max(rect.width, rect.height) / 2 + range;
      if (dist > max) {
        el.style.transform = "translate3d(0,0,0)";
        return;
      }
      const falloff = 1 - dist / max;
      el.style.transform = `translate3d(${dx * strength * falloff}px, ${dy * strength * falloff}px, 0)`;
    };
    const reset = () => {
      el.style.transform = "translate3d(0,0,0)";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", reset);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", reset);
    };
  }, [strength, range]);

  return (
    <span
      ref={ref}
      className={`inline-block transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] ${className}`}
    >
      {children}
    </span>
  );
}
