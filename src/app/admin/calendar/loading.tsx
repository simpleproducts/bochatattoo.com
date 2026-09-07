/**
 * Shown while /admin/calendar reads the month indexes and their records.
 *
 * Same reasoning as the gallery's: the tab bar navigates, and the calendar's
 * first paint waits on R2. The skeleton keeps the page's shape — nav bar,
 * header, toolbar row, then the month grid — so nothing jumps when the real
 * data lands.
 */
export default function CalendarLoading() {
  return (
    <main className="flex-1 px-4 md:px-8 py-6 flex flex-col gap-6">
      <div className="h-[41px] border-b border-line" />
      <div className="flex items-baseline gap-4">
        <div className="h-8 w-40 bg-line/60 animate-pulse" />
        <div className="h-3 w-32 bg-line/40 animate-pulse" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-8 w-48 bg-line/60 animate-pulse" />
        <div className="h-10 w-28 bg-line/40 animate-pulse" />
      </div>
      <div className="grid grid-cols-7 border-t border-l border-line">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="border-r border-b border-line min-h-[120px]" />
        ))}
      </div>
    </main>
  );
}
