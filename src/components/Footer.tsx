export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="px-6 md:px-10 py-10 border-t border-line mt-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-xs uppercase tracking-[0.2em] font-mono text-muted">
        <span className="font-serif italic text-base normal-case tracking-tight text-fg">
          bocha
        </span>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li><a href="https://instagram.com/" target="_blank" rel="noreferrer" className="hover:text-fg transition-colors">Instagram</a></li>
          <li><a href="https://wa.me/" target="_blank" rel="noreferrer" className="hover:text-fg transition-colors">WhatsApp</a></li>
          <li><a href="mailto:hello@bochatattoo.com" className="hover:text-fg transition-colors">Email</a></li>
        </ul>
        <span>© {year} — Bocha</span>
      </div>
    </footer>
  );
}
