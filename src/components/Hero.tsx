export function Hero() {
  return (
    <section
      id="top"
      className="relative min-h-screen flex flex-col justify-end px-6 md:px-10 pb-16 pt-32"
    >
      <div className="absolute inset-0 -z-10 grid grid-cols-12 pointer-events-none opacity-[0.04]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="border-l border-fg last:border-r" />
        ))}
      </div>

      <div className="flex items-start justify-between gap-8 mb-10 text-xs uppercase tracking-[0.2em] font-mono text-muted">
        <span>Est. 20XX — Placeholder</span>
        <span className="hidden md:inline">By appointment / Worldwide</span>
        <span>Vol. I</span>
      </div>

      <h1 className="font-serif leading-[0.85] tracking-tight text-[18vw] md:text-[14vw]">
        <span className="block">bocha</span>
        <span className="block italic text-muted">tattoo</span>
      </h1>

      <div className="mt-10 grid md:grid-cols-3 gap-6 md:gap-10 items-end">
        <p className="md:col-span-2 max-w-xl text-balance text-lg md:text-xl leading-snug">
          A tattoo studio rooted in considered drawing — placeholder copy
          describing the practice, the philosophy, and the wave that carries
          each piece from sketch to skin.
        </p>
        <a
          href="#work"
          className="self-end inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em] font-mono group"
        >
          <span>View the work</span>
          <span aria-hidden className="inline-block w-10 h-px bg-current transition-all group-hover:w-16" />
        </a>
      </div>
    </section>
  );
}
