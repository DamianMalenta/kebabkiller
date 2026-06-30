import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { darkroomPath } from '../../lib/deskRoutes.js';
import { SceneContinuityRow } from '../../components/ContinuityPicker.jsx';
import { START_FRAME_SOURCE_LABELS } from './startFrameSourceConstants.js';
import DarkroomProductionPanel from './DarkroomProductionPanel.jsx';

function scenePreviewAsset(scene, assetsByOrder) {
  const approved = assetsByOrder.get(scene.sort_order);
  if (approved?.raw_image_path) return approved.raw_image_path;
  if (scene.start_frame_path) return scene.start_frame_path;
  return null;
}

function sceneReadinessLabel(scene, assetsByOrder) {
  if (scene.sort_order === 0 || scene.start_frame_source === 'darkroom') {
    const asset = assetsByOrder.get(scene.sort_order);
    if (asset?.status === 'APPROVED') return { text: 'Kadr zatwierdzony', tone: 'ok' };
    if (asset) return { text: 'Oczekuje w poczekalni', tone: 'warn' };
    return { text: 'Brak zdjęcia — wgraj w Wlocie', tone: 'bad' };
  }
  if (scene.start_frame_source === 'previous_scene') {
    return { text: 'Ciągłość z poprzedniej sceny', tone: 'ok' };
  }
  return { text: 'Wybierz źródło klatki', tone: 'bad' };
}

function SceneCard({
  scene,
  planId,
  assetsByOrder,
  busy,
  onPlanUpdated,
  onSetSource,
}) {
  const [description, setDescription] = useState(scene.description_pl || '');
  const [savingDesc, setSavingDesc] = useState(false);
  const label = scene.sort_order + 1;
  const preview = scenePreviewAsset(scene, assetsByOrder);
  const readiness = sceneReadinessLabel(scene, assetsByOrder);
  const isAnchor = scene.sort_order === 0;
  const source = scene.start_frame_source || (isAnchor ? 'darkroom' : null);

  useEffect(() => {
    setDescription(scene.description_pl || '');
  }, [scene.id, scene.description_pl]);

  async function saveDescription() {
    if (description === (scene.description_pl || '')) return;
    setSavingDesc(true);
    try {
      const result = await api.episodePlans.upsertScene(planId, {
        id: scene.id,
        sort_order: scene.sort_order,
        description_pl: description,
        duration_sec: scene.duration_sec,
      });
      onPlanUpdated(result.plan ?? result);
    } finally {
      setSavingDesc(false);
    }
  }

  const toneClass = readiness.tone === 'ok'
    ? 'text-emerald-400'
    : readiness.tone === 'warn'
      ? 'text-amber-400'
      : 'text-red-400';

  return (
    <article className="border border-zinc-800 bg-zinc-950/80">
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        <div className="flex h-36 w-full shrink-0 items-center justify-center overflow-hidden border border-zinc-800 bg-black sm:w-28">
          {preview ? (
            <img src={preview} alt={`Scena ${label}`} className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs text-zinc-600">Brak podglądu</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              Scena {label}
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {scene.duration_sec}s
              </span>
            </h3>
            <span className={`text-xs font-medium ${toneClass}`}>{readiness.text}</span>
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-widest text-zinc-600">Opis sceny</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              disabled={busy || savingDesc}
              rows={2}
              className="mt-1 w-full resize-y border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-amber-600"
            />
          </label>

          {isAnchor ? (
            <p className="text-xs text-emerald-600/90">
              {START_FRAME_SOURCE_LABELS.darkroom}
              <span className="text-zinc-600"> — anchor odcinka</span>
            </p>
          ) : (
            <fieldset disabled={busy} className="space-y-2">
              <legend className="text-xs uppercase tracking-widest text-zinc-600">Źródło klatki</legend>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
                  <input
                    type="radio"
                    name={`source-${scene.id}`}
                    checked={source === 'darkroom'}
                    onChange={() => onSetSource(scene.id, 'darkroom')}
                    className="accent-emerald-500"
                  />
                  {START_FRAME_SOURCE_LABELS.darkroom}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
                  <input
                    type="radio"
                    name={`source-${scene.id}`}
                    checked={source === 'previous_scene'}
                    onChange={() => onSetSource(scene.id, 'previous_scene')}
                    className="accent-amber-500"
                  />
                  {START_FRAME_SOURCE_LABELS.previous_scene}
                </label>
              </div>
            </fieldset>
          )}
        </div>
      </div>

      {!isAnchor && source === 'previous_scene' && (
        <div className="border-t border-zinc-800 p-4">
          <SceneContinuityRow
            planId={planId}
            scene={scene}
            onChanged={() => onPlanUpdated()}
          />
        </div>
      )}
    </article>
  );
}

export default function DarkroomSceneManager({ projectId, episodePlanId }) {
  const [plan, setPlan] = useState(null);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!episodePlanId) return;
    setError('');
    try {
      const [planData, assetData] = await Promise.all([
        api.episodePlans.get(episodePlanId),
        api.darkroom.getAssets(episodePlanId),
      ]);
      setPlan(planData);
      setAssets(assetData.scene_assets || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [episodePlanId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const assetsByOrder = useMemo(() => {
    const map = new Map();
    for (const asset of assets) {
      if (asset.status === 'APPROVED') {
        map.set(asset.sort_order, asset);
      }
    }
    return map;
  }, [assets]);

  const scenes = useMemo(
    () => [...(plan?.scenes || [])].sort((a, b) => a.sort_order - b.sort_order),
    [plan?.scenes],
  );

  async function setSource(sceneId, source) {
    setBusy(true);
    setError('');
    try {
      const result = await api.episodePlans.setStartFrameSource(plan.id, sceneId, source);
      setPlan(result.plan ?? result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addScene() {
    setBusy(true);
    setError('');
    try {
      const nextOrder = scenes.length;
      const result = await api.episodePlans.upsertScene(episodePlanId, {
        sort_order: nextOrder,
        description_pl: `Scena ${nextOrder + 1}`,
        duration_sec: 4,
        start_frame_source: nextOrder === 0 ? 'darkroom' : 'previous_scene',
      });
      setPlan(result.plan ?? result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !plan) {
    return <p className="text-center text-zinc-500">Ładowanie scen…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-zinc-200">Sceny odcinka</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {scenes.length} scen · ustaw źródło klatki i ciągłość przed produkcją
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={darkroomPath(projectId, episodePlanId, 'upload')}
            className="rounded border border-zinc-700 px-3 py-2 text-xs uppercase tracking-wider text-zinc-400 hover:bg-zinc-900"
          >
            Wlot zdjęć
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={addScene}
            className="rounded border border-amber-700 px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-400 hover:bg-amber-950/40 disabled:opacity-50"
          >
            + Scena
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {scenes.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Brak scen — wgraj zdjęcia w Wlocie lub dodaj scenę ręcznie.
        </p>
      ) : (
        <div className="space-y-4">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              planId={episodePlanId}
              assetsByOrder={assetsByOrder}
              busy={busy}
              onPlanUpdated={() => load()}
              onSetSource={setSource}
            />
          ))}
        </div>
      )}

      <DarkroomProductionPanel episodePlanId={episodePlanId} />
    </div>
  );
}
