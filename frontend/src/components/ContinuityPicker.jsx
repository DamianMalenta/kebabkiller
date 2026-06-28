import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

/**
 * Filar 3 — Picker kadru kontynuacji.
 * Dla każdej sceny N>0 pokazuje klatki wyekstrahowane z klipu sceny POPRZEDNIEJ
 * i pozwala wybrać kadr, od którego ma startować dana scena (spójna kontynuacja).
 * „Auto" = klatka końcowa poprzedniej sceny (domyślne zachowanie).
 */
export function SceneContinuityRow({ planId, scene, onChanged, showProduceHint = false }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.continuity.frames(planId, scene.id));
    } catch (err) {
      setError(err.message);
    }
  }, [planId, scene.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function choose(framePath) {
    setBusy(true);
    setError('');
    try {
      await api.continuity.setStartFrame(planId, scene.id, framePath);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const frames = data?.frames || [];
  const current = data?.current_start_frame || null;
  const isAuto = !current;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-400">
          Scena {scene.sort_order + 1}
          <span className="ml-2 font-normal text-zinc-400">{scene.description_pl?.slice(0, 48) || ''}</span>
        </p>
        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${isAuto ? 'bg-zinc-800 text-zinc-400' : 'bg-emerald-900/60 text-emerald-300'}`}>
          {isAuto ? 'Auto (klatka końcowa)' : 'Wybrany kadr'}
        </span>
      </div>

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {frames.length === 0 ? (
        <div className="text-xs text-zinc-500">
          <p>Brak klatek poprzedniej sceny — wyprodukuj odcinek, żeby wybrać kadr kontynuacji.</p>
          {showProduceHint && (
            <p className="mt-2 text-amber-400/80">
              Plan odcinka gotowy — użyj przycisku „Uruchom Produkcję GPU” w czacie poniżej.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => choose(null)}
              className={`flex h-28 w-16 shrink-0 items-center justify-center rounded-lg border text-center text-[10px] font-semibold transition ${
                isAuto ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300' : 'border-zinc-700 text-zinc-400 hover:border-emerald-600'
              }`}
            >
              Auto
            </button>
            {frames.map((frame) => {
              const selected = current === frame.path;
              return (
                <button
                  key={frame.path}
                  type="button"
                  disabled={busy}
                  onClick={() => choose(frame.path)}
                  className={`relative shrink-0 overflow-hidden rounded-lg border transition ${
                    selected ? 'border-emerald-500 ring-2 ring-emerald-500/40' : 'border-zinc-700 hover:border-amber-500'
                  }`}
                  title={frame.label}
                >
                  <img src={frame.path} alt={frame.label} className="h-28 w-16 object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[9px] text-zinc-200">
                    {frame.is_last ? 'koniec' : frame.label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-zinc-500">
            Kadr startowy z klipu sceny {scene.sort_order} ({data?.prev_clip_code || '—'}).
          </p>
        </>
      )}
    </div>
  );
}

export default function ContinuityPicker({ planId }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError('');
    try {
      setPlan(await api.episodePlans.get(planId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!planId) return null;
  if (loading && !plan) return <p className="text-xs text-zinc-500">Ładowanie ciągłości…</p>;

  const scenes = (plan?.scenes || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const continuationScenes = scenes.filter((s) => s.sort_order > 0);

  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Silnik ciągłości</p>
        <h2 className="text-sm font-bold text-amber-400">Kadr kontynuacji scen</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Każda scena (od 2.) startuje z kadru poprzedniej — spójny odcinek. Domyślnie klatka końcowa; możesz wybrać inny kadr.
        </p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {continuationScenes.length === 0 ? (
        <p className="text-xs text-zinc-500">Odcinek ma jedną scenę — ciągłość nie dotyczy.</p>
      ) : (
        <div className="space-y-3">
          {continuationScenes.map((scene) => (
            <SceneContinuityRow key={scene.id} planId={planId} scene={scene} onChanged={load} />
          ))}
        </div>
      )}
    </section>
  );
}
