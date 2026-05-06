import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 md:px-10 text-center">
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-6">
        404
      </span>
      <h1 className="font-serif italic text-[20vw] md:text-[10vw] leading-none tracking-tight">
        lost
      </h1>
      <p className="mt-6 max-w-md text-fg/70 text-base md:text-lg">
        Esta página no existe.{" "}
        <span className="text-muted">This page doesn&apos;t exist.</span>
      </p>
      <div className="mt-10 flex items-center gap-6 text-xs uppercase tracking-[0.2em] font-mono">
        <Link href="/" className="inline-flex items-center gap-2 border-b border-current pb-1">
          <span aria-hidden>←</span>
          <span>Inicio</span>
        </Link>
        <Link href="/en" className="inline-flex items-center gap-2 border-b border-current pb-1 opacity-50 hover:opacity-100 transition-opacity">
          <span aria-hidden>←</span>
          <span>Home</span>
        </Link>
      </div>
    </main>
  );
}
