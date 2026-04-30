import { Placeholder } from "./Placeholder";

export function About() {
  return (
    <section
      id="about"
      className="px-6 md:px-10 py-24 md:py-32 border-t border-line"
    >
      <div className="grid md:grid-cols-12 gap-8 md:gap-12">
        <div className="md:col-span-5">
          <Placeholder label="Portrait — Bocha" ratio="portrait" />
        </div>

        <div className="md:col-span-7 flex flex-col justify-between gap-12">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              02 / About
            </span>
          </div>

          <h2 className="font-serif text-4xl md:text-6xl leading-[0.95]">
            Drawing first.{" "}
            <span className="italic text-muted">Tattooing second.</span>
          </h2>

          <div className="grid sm:grid-cols-2 gap-6 text-base md:text-lg leading-relaxed text-fg/85 max-w-3xl">
            <p>
              Placeholder bio paragraph. A short, honest description of who
              Bocha is, where the studio sits, and how the practice took shape
              over the years.
            </p>
            <p>
              Placeholder for the philosophy: how each tattoo emerges from a
              conversation, what kind of work the studio is most known for, and
              the kinds of pieces Bocha is drawn to building.
            </p>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-line text-xs uppercase tracking-[0.2em] font-mono text-muted">
            <div>
              <dt>Based</dt>
              <dd className="text-fg mt-1 normal-case tracking-normal font-sans text-sm">Placeholder</dd>
            </div>
            <div>
              <dt>Style</dt>
              <dd className="text-fg mt-1 normal-case tracking-normal font-sans text-sm">Placeholder</dd>
            </div>
            <div>
              <dt>Booking</dt>
              <dd className="text-fg mt-1 normal-case tracking-normal font-sans text-sm">By request</dd>
            </div>
            <div>
              <dt>Since</dt>
              <dd className="text-fg mt-1 normal-case tracking-normal font-sans text-sm">20XX</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
