export function Contact() {
  return (
    <section
      id="contact"
      className="px-6 md:px-10 py-24 md:py-40 border-t border-line"
    >
      <div className="flex items-baseline justify-between mb-10">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          04 / Contact
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Currently booking
        </span>
      </div>

      <h2 className="font-serif text-[14vw] md:text-[10vw] leading-[0.9] tracking-tight">
        Get a <span className="italic text-muted">tattoo.</span>
      </h2>

      <div className="mt-12 grid md:grid-cols-3 gap-8 md:gap-12 max-w-5xl">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-2">
            Direct
          </p>
          <a
            href="mailto:hello@bochatattoo.com"
            className="text-lg md:text-xl border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
          >
            hello@bochatattoo.com
          </a>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-2">
            Instagram
          </p>
          <a
            href="https://instagram.com/"
            target="_blank"
            rel="noreferrer"
            className="text-lg md:text-xl border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
          >
            @bocha.tattoo
          </a>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted mb-2">
            Booking
          </p>
          <a
            href="https://wa.me/"
            target="_blank"
            rel="noreferrer"
            className="text-lg md:text-xl border-b border-current pb-0.5 hover:opacity-60 transition-opacity"
          >
            WhatsApp →
          </a>
        </div>
      </div>
    </section>
  );
}
