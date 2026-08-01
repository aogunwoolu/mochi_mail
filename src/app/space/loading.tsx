export default function SpaceLoading() {
  return (
    <div className="flex h-svh items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="panel animate-fade-in flex flex-col items-center rounded-3xl px-8 py-6 text-center">
        <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="var(--pink)" strokeWidth="2.5" strokeDasharray="28 56" strokeLinecap="round" />
        </svg>
        <p className="mt-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Opening this space...
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
          Unpacking stickers and hanging the wallpaper.
        </p>
      </div>
    </div>
  );
}
