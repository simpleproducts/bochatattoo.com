/**
 * Shown while /admin/gallery fetches the manifest.
 *
 * The Images and Categories tabs are real URLs rather than client state, which
 * is what lets one server-rendered tab bar cover all three sections — but it
 * also means switching tabs is a server round trip that reads R2. Without a
 * fallback the old page just sat there for a beat and the click felt ignored.
 *
 * Deliberately mirrors the real page's skeleton — same <main> padding, same
 * nav-height bar, same header block — so the switch reads as the page filling
 * in rather than as a flash of something else.
 */
export default function GalleryLoading() {
  return (
    <main className="flex-1 px-4 md:px-8 py-6 flex flex-col gap-6">
      <div className="h-[41px] border-b border-line" />
      <div className="flex items-baseline gap-4">
        <div className="h-8 w-40 bg-line/60 animate-pulse" />
        <div className="h-3 w-32 bg-line/40 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="aspect-square bg-line/40 animate-pulse" />
        ))}
      </div>
    </main>
  );
}
