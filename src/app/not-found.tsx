import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 md:px-10 text-center">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-6">
        404 — Not found
      </span>
      <h1 className="font-serif italic text-[20vw] md:text-[10vw] leading-none tracking-tight">
        lost
      </h1>
      <p className="mt-6 max-w-md text-fg/70 text-base md:text-lg">
        This page doesn&apos;t exist — or it never did. Head back to the studio.
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono border-b border-current pb-1"
      >
        <span aria-hidden>←</span>
        <span>Back home</span>
      </Link>
    </main>
  );
}
