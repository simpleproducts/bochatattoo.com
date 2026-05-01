import { Placeholder } from "./Placeholder";
import { RemoteImage } from "./RemoteImage";
import { Reveal } from "./Reveal";
import { getImage } from "@/lib/images";

const PIECES: { slug: string; ratio: "portrait" | "square" | "landscape" | "tall" }[] = [
  { slug: "untitled-forearm", ratio: "portrait" },
  { slug: "untitled-sternum", ratio: "tall" },
  { slug: "untitled-hand", ratio: "square" },
  { slug: "untitled-calf", ratio: "portrait" },
  { slug: "untitled-back", ratio: "landscape" },
  { slug: "untitled-thigh", ratio: "portrait" },
  { slug: "untitled-ribs", ratio: "tall" },
  { slug: "untitled-neck", ratio: "square" },
  { slug: "untitled-shoulder", ratio: "portrait" },
];

const RATIO_CLASS = {
  portrait: "aspect-[3/4]",
  square: "aspect-square",
  landscape: "aspect-[4/3]",
  tall: "aspect-[2/3]",
} as const;

export function Work() {
  return (
    <section id="work" className="px-6 md:px-10 py-24 md:py-32">
      <Reveal>
        <div className="flex items-baseline justify-between mb-12 md:mb-16">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            01 / Work
          </span>
          <h2 className="font-serif italic text-3xl md:text-5xl">
            Selected pieces
          </h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        {PIECES.map((p, i) => {
          const entry = getImage(p.slug);
          return (
            <Reveal key={p.slug} delay={(i % 3) * 80}>
              <div
                data-cursor
                className={`relative ${RATIO_CLASS[p.ratio]} bg-line overflow-hidden tile`}
              >
                {entry ? (
                  <RemoteImage
                    slug={p.slug}
                    fill
                    sizes="(min-width: 768px) 33vw, 50vw"
                    className="object-cover tile-img"
                  />
                ) : (
                  <Placeholder
                    label={p.slug.replace(/-/g, " ")}
                    ratio={p.ratio}
                    index={i + 1}
                  />
                )}
                <div
                  aria-hidden
                  className="tile-overlay absolute inset-0 bg-bg/0 transition-colors duration-500 flex items-end p-4"
                >
                  <span className="opacity-0 -translate-y-2 transition-all duration-500 tile-label text-[10px] uppercase tracking-[0.2em] font-mono text-fg">
                    {String(i + 1).padStart(2, "0")} — {p.slug.replace(/-/g, " ")}
                  </span>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      <div className="mt-12 flex justify-end">
        <a
          href="#contact"
          className="text-xs uppercase tracking-[0.2em] font-mono border-b border-current pb-1 hover:opacity-60 transition-opacity"
        >
          Inquire about a piece →
        </a>
      </div>
    </section>
  );
}
