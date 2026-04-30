export function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 mix-blend-difference">
      <nav className="flex items-center justify-between px-6 md:px-10 py-5 text-fg">
        <a
          href="#top"
          className="font-serif italic text-xl md:text-2xl tracking-tight"
          aria-label="Bocha — home"
        >
          bocha
        </a>

        <ul className="hidden md:flex items-center gap-8 text-xs uppercase tracking-[0.2em] font-mono">
          <li><a href="#work" className="hover:opacity-60 transition-opacity">Work</a></li>
          <li><a href="#about" className="hover:opacity-60 transition-opacity">About</a></li>
          <li><a href="#process" className="hover:opacity-60 transition-opacity">Process</a></li>
          <li><a href="#contact" className="hover:opacity-60 transition-opacity">Contact</a></li>
        </ul>

        <a
          href="#contact"
          className="text-xs uppercase tracking-[0.2em] font-mono border border-current rounded-full px-4 py-2 hover:bg-fg hover:text-bg transition-colors"
        >
          Book
        </a>
      </nav>
    </header>
  );
}
