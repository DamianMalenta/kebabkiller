const STEPS = [
  { id: 'step-1', label: '1 Pomysł' },
  { id: 'step-2', label: '2 Scenarzysta' },
  { id: 'step-3', label: '3 Sceny' },
  { id: 'step-4', label: '4 Materiały' },
  { id: 'step-5', label: '5 Produkcja' },
];

export default function MobileStepNav({ steps = STEPS }) {
  return (
    <nav
      className="sticky top-0 z-30 -mx-4 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-2 backdrop-blur md:hidden"
      aria-label="Skocz do kroku"
    >
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {steps.map(({ id, label, done }) => (
          <a
            key={id}
            href={`#${id}`}
            className={`shrink-0 snap-start rounded-full px-3 py-2 text-sm font-medium transition active:scale-95 ${
              done
                ? 'border border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
                : 'border border-zinc-700 bg-zinc-900 text-zinc-300'
            }`}
          >
            {done ? '✓ ' : ''}{label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function MobileStickyAccept({ canAccept, busy, reason, onAccept, statusLabel }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 px-3 md:hidden">
      <div className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-3 shadow-xl shadow-black/40 backdrop-blur">
        {canAccept ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-bold text-white active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? 'Akceptuję…' : '✓ Akceptuj plan i start produkcji'}
          </button>
        ) : (
          <div className="text-center">
            <p className="text-xs font-medium text-amber-300">{statusLabel}</p>
            <p className="mt-1 text-xs text-zinc-500">{reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
