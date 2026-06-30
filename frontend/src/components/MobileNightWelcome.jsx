import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useDayPhase, useIsCoarsePointer } from '../hooks/useMobile.js';

const STATUS_HINTS = {
  szkic: 'Uzupełnij pomysł i poproś Scenarzystę',
  brakuje_materialow: 'Wrzuć brakujące JPG w katalogu',
  gotowy_do_akceptacji: 'Gotowe — możesz akceptować plan',
  zaakceptowany: 'Plan zaakceptowany — produkcja wystartuje',
  w_produkcji: 'Render w toku — sprawdź sekcję Produkcja',
  gotowy: 'Odcinek gotowy — obejrzyj klipy',
};

export default function MobileCompanionPanel({ episodes, onNewEpisode, creating }) {
  const mobile = useIsCoarsePointer();
  const phase = useDayPhase();
  const [health, setHealth] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('kk-companion-dismiss') === '1');

  const latestEpisode = episodes?.[0];

  useEffect(() => {
    if (!mobile) return;
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setHealth({ ok: true, ...data }))
      .catch(() => setHealth({ ok: false }));
  }, [mobile]);

  if (!mobile || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem('kk-companion-dismiss', '1');
    setDismissed(true);
  }

  async function copyLink() {
    const url = window.location.origin;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  const panelCopy = {
    night: {
      badge: 'Tryb wieczorny',
      title: 'Dobranoc — testuj z łóżka',
      body: 'Stół Reżyserski działa płynnie na telefonie. Zaplanuj projekt i wrzuć assety do kanonu w panelu Katalog.',
      emoji: '🌙',
    },
    morning: {
      badge: 'Dzień dobry',
      title: 'Witaj z powrotem na planie',
      body: 'Wejdź w Reżyserię, aby kontynuować ostatni projekt, albo wrzuć nowe zdjęcia do Katalogu.',
      emoji: '☀️',
    },
    day: {
      badge: 'Tryb mobilny',
      title: 'Studio w kieszeni',
      body: 'Stół Reżyserski (Director\'s Desk) w 100% responsywny. Użyj dolnego menu, aby przeskakiwać między Katalogiem a Reżyserią.',
      emoji: '📱',
    },
  }[phase];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-indigo-900/40 bg-gradient-to-br from-indigo-950/80 via-zinc-950 to-amber-950/30 p-5 shadow-lg shadow-indigo-950/40">
      <div className="pointer-events-none absolute -right-4 -top-4 text-6xl opacity-20" aria-hidden>
        {panelCopy.emoji}
      </div>
      <p className="text-xs font-medium uppercase tracking-widest text-indigo-300/80">{panelCopy.badge}</p>
      <h2 className="mt-1 text-xl font-bold text-zinc-50">{panelCopy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{panelCopy.body}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2.5 py-1 ${
            health?.ok ? 'bg-emerald-900/50 text-emerald-300' : health === null ? 'bg-zinc-800 text-zinc-400' : 'bg-red-900/50 text-red-300'
          }`}
        >
          {health === null ? 'Sprawdzam serwer…' : health.ok ? 'Serwer OK' : 'Brak API — odśwież'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <Link
          to="/desk"
          className="rounded-xl bg-amber-500 px-4 py-3.5 text-base text-center font-bold text-zinc-950 active:scale-[0.98] shadow-md shadow-amber-500/20"
        >
          🎬 Reżyseria (Czat)
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/catalog"
            className="rounded-xl border border-zinc-600 bg-zinc-900/80 px-4 py-3.5 text-center text-base font-semibold text-zinc-100 active:scale-[0.98]"
          >
            📷 Katalog
          </Link>
          <Link
            to="/projects"
            className="rounded-xl border border-indigo-700/50 bg-indigo-950/40 px-4 py-3.5 text-center text-sm font-semibold text-indigo-100 active:scale-[0.98]"
          >
            📚 Seriale
          </Link>
        </div>
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="mt-4 text-xs text-zinc-600 underline hover:text-zinc-400"
      >
        Schowaj na tę sesję
      </button>
    </section>
  );
}

export function MobileQuickNav() {
  const mobile = useIsCoarsePointer();
  if (!mobile) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden"
      aria-label="Szybka nawigacja"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5">
        <QuickNavLink to="/projects" label="Seriale" />
        <QuickNavLink to="/catalog" label="Katalog" />
        <QuickNavLink to="/desk" label="Reżyseria" />
        <QuickNavLink to="/settings" label="Wiedza" />
      </div>
    </nav>
  );
}

function QuickNavLink({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-[48px] min-w-[56px] flex-col items-center justify-center rounded-xl px-2 text-xs font-medium transition active:scale-95 ${
          isActive ? 'text-amber-400' : 'text-zinc-500'
        }`
      }
    >
      {label}
    </NavLink>
  );
}

// Backward-compatible export name
export { MobileCompanionPanel as MobileNightWelcome };
