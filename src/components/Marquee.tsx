export function Marquee({ phrases }: { phrases: string[] }) {
  const items = [...phrases, ...phrases];
  return (
    <section aria-hidden className="border-y border-line py-6 overflow-hidden">
      <div className="flex gap-12 whitespace-nowrap animate-marquee will-change-transform">
        {items.map((phrase, i) => (
          <span
            key={i}
            className="font-serif italic text-3xl md:text-5xl text-muted"
          >
            {phrase}{" "}
            <span className="not-italic font-mono text-fg/40 mx-6">✦</span>
          </span>
        ))}
      </div>
    </section>
  );
}
