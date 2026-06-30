import { useCallback, useState } from 'react';
import { api } from '../../api/client.js';
import { START_FRAME_SOURCE_LABELS } from './startFrameSourceConstants.js';

/**
 * Jawny wybór źródła klatki startowej per scena (od Sceny 2 w górę).
 * Scena 1 jest zawsze „Nowe zdjęcie (Darkroom)" — tylko informacja.
 */
export default function StartFrameSourcePanel({ plan, onPlanUpdated, disabled = false }) {
  const [busySceneId, setBusySceneId] = useState(null);
  const [error, setError] = useState('');

  const scenes = [...(plan?.scenes || [])].sort((a, b) => a.sort_order - b.sort_order);
  const anchor = scenes.find((s) => s.sort_order === 0) || scenes[0];

  const setSource = useCallback(async (sceneId, source) => {
    if (!plan?.id || disabled) return;
    setError('');
    setBusySceneId(sceneId);
    try {
      const result = await api.episodePlans.setStartFrameSource(plan.id, sceneId, source);
      onPlanUpdated?.(result.plan ?? result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusySceneId(null);
    }
  }, [plan?.id, disabled, onPlanUpdated]);

  if (!plan?.scenes?.length) return null;

  return (
    <section className="space-y-4 border border-zinc-800 bg-zinc-950/60 px-4 py-4">
      <div>
        <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500">Źródło klatki startowej</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Wybierz jawnie dla każdej sceny — system nie zgaduje źródła przy produkcji.
        </p>
      </div>

      {anchor && (
        <div className="border border-zinc-800/80 bg-zinc-900/40 px-3 py-3">
          <p className="text-sm font-medium text-zinc-300">
            Scena 1
            <span className="ml-2 text-xs font-normal text-zinc-500">(anchor)</span>
          </p>
          <p className="mt-1 text-xs text-emerald-600/90">
            {START_FRAME_SOURCE_LABELS.darkroom}
            <span className="text-zinc-600"> — zawsze wymaga nowego zdjęcia</span>
          </p>
        </div>
      )}

      {scenes.filter((s) => s.sort_order > 0).map((scene) => {
        const label = scene.sort_order + 1;
        const current = scene.start_frame_source || null;
        const busy = busySceneId === scene.id;

        return (
          <fieldset
            key={scene.id}
            disabled={disabled || busy}
            className={`border px-3 py-3 ${busy ? 'opacity-60' : ''} ${
              current === 'previous_scene' ? 'border-amber-900/40 bg-amber-950/10' : 'border-zinc-800/80 bg-zinc-900/30'
            }`}
          >
            <legend className="px-1 text-sm font-medium text-zinc-300">
              Scena {label}
            </legend>
            {scene.description_pl && (
              <p className="mb-3 text-xs text-zinc-600 line-clamp-2">{scene.description_pl}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
                <input
                  type="radio"
                  name={`start-frame-source-${scene.id}`}
                  checked={current === 'darkroom'}
                  onChange={() => setSource(scene.id, 'darkroom')}
                  disabled={disabled || busy}
                  className="accent-emerald-500"
                />
                {START_FRAME_SOURCE_LABELS.darkroom}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
                <input
                  type="radio"
                  name={`start-frame-source-${scene.id}`}
                  checked={current === 'previous_scene'}
                  onChange={() => setSource(scene.id, 'previous_scene')}
                  disabled={disabled || busy}
                  className="accent-amber-500"
                />
                {START_FRAME_SOURCE_LABELS.previous_scene}
              </label>
            </div>
            {!current && (
              <p className="mt-2 text-xs text-amber-500">Wybierz źródło przed produkcją.</p>
            )}
            {current === 'previous_scene' && (
              <p className="mt-2 text-xs text-zinc-600">Wgrywanie zdjęcia dla tej sceny jest zablokowane.</p>
            )}
          </fieldset>
        );
      })}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </section>
  );
}
