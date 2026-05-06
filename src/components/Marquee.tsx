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
            <span aria-hidden className="mx-6 inline-block align-middle text-fg/40">
              <svg
                viewBox="0 0 18 18"
                preserveAspectRatio="xMidYMid meet"
                className="h-5 md:h-6 w-auto"
                fill="currentColor"
              >
                <path d="M9 9 Q 5 5 9 0.5 Q 13 5 9 9 Z" />
                <path d="M9 9 Q 13 5 17.5 9 Q 13 13 9 9 Z" />
                <path d="M9 9 Q 13 13 9 17.5 Q 5 13 9 9 Z" />
                <path d="M9 9 Q 5 13 0.5 9 Q 5 5 9 9 Z" />
              </svg>
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
