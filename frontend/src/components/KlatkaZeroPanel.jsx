import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

const DEFAULT_COMPOSITE = {
  scale: 0.52,
  heightScale: 0.42,
  position: { x: 0.5, y: 0.9 },
  source: 'compose',
};

function assetImagePath(asset) {
  return (asset?.images?.find((i) => i.is_primary) || asset?.images?.[0])?.path;
}

function buildCompositeFromScene(scene) {
  const saved = scene?.ai_overrides?.composite || {};
  return {
    ...DEFAULT_COMPOSITE,
    ...saved,
    position: { ...DEFAULT_COMPOSITE.position, ...(saved.position || {}) },
  };
}

function initialSelectionFromScene(scene) {
  const composite = buildCompositeFromScene(scene);
  return {
    characterId: composite.characterAssetId || scene?.asset_id || null,
    locationId: composite.locationAssetId || scene?.location_asset_id || null,
    compositionText: composite.composition_override || '',
    composite,
  };
}

const FROZEN_STATUSES = new Set(['zaakceptowany', 'w_produkcji', 'gotowy']);

function isPlanFrozenStatus(status) {
  return FROZEN_STATUSES.has(status);
}

export default function KlatkaZeroPanel({
  characterAssets = [],
  locationAssets = [],
  planId,
  sceneId,
  scene = null,
  planStatus = null,
  embedded = false,
  onSaved,
}) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [compositionText, setCompositionText] = useState('');
  const [compositeConfig, setCompositeConfig] = useState(DEFAULT_COMPOSITE);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    const initial = initialSelectionFromScene(scene);
    setSelectedCharacterId(initial.characterId);
    setSelectedLocationId(initial.locationId);
    setCompositionText(initial.compositionText);
    setCompositeConfig(initial.composite);
    setPreview(null);
    setError('');
    setMessage('');
  }, [sceneId, scene]);

  const runPreview = useCallback(async () => {
    if (!selectedCharacterId && !selectedLocationId) {
      setPreview(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.composite.preview({
        characterAssetId: selectedCharacterId || undefined,
        locationAssetId: selectedLocationId || undefined,
        sceneComposite: {
          ...compositeConfig,
          composition_override: compositionText || undefined,
        },
      });
      setPreview(res);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCharacterId, selectedLocationId, compositionText, compositeConfig]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runPreview, 300);
    return () => clearTimeout(debounceRef.current);
  }, [runPreview]);

  async function handleSave() {
    if (!planId || !sceneId || !selectedCharacterId || !selectedLocationId) return;
    if (isPlanFrozenStatus(planStatus)) {
      setError('Plan jest zamrożony — edycja możliwa tylko w statusie szkic / gotowy_do_akceptacji.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    const compositePayload = {
      ...compositeConfig,
      characterAssetId: selectedCharacterId,
      locationAssetId: selectedLocationId,
      composition_override: compositionText || undefined,
      frame_confirmed: true,
    };
    try {
      await Promise.all([
        api.episodePlans.attachSceneAssets(planId, sceneId, {
          asset_id: selectedCharacterId,
          location_asset_id: selectedLocationId,
        }),
        api.composite.setSceneOverride(planId, sceneId, compositePayload),
      ]);
      setMessage('Parametry sceny zablokowane — assety i composite zapisane.');
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!planId || !sceneId) return null;

  const readOnly = isPlanFrozenStatus(planStatus);

  const shellClass = embedded
    ? 'flex flex-col gap-6'
    : 'flex flex-col gap-6 rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl';

  return (
    <div className={shellClass}>
      {!embedded && (
        <div className="border-b border-zinc-800 pb-4">
          <h2 className="text-lg font-semibold uppercase tracking-wide text-zinc-100">Klatka Zero</h2>
          <p className="mt-1 font-mono text-xs text-zinc-500">SCENE_ID: {sceneId}</p>
        </div>
      )}

      {readOnly && (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-200">
          Plan w statusie <strong>{planStatus}</strong> — podgląd działa, zapis wyłączony. Poczekaj na koniec produkcji lub użyj nowego odcinka.
        </p>
      )}

      {error && <p className="rounded-lg bg-red-950/60 p-3 text-sm text-red-300">{error}</p>}
      {message && <p className="rounded-lg bg-emerald-950/40 p-3 text-sm text-emerald-300">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_200px]">
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Aktor (IP-Adapter)</h3>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {characterAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => !readOnly && setSelectedCharacterId(asset.id)}
                  disabled={readOnly}
                  className={`group relative aspect-[3/4] overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                    selectedCharacterId === asset.id
                      ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                      : 'border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <img
                    src={assetImagePath(asset)}
                    alt={asset.name}
                    className="h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-100"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 pt-6 text-center text-[10px] font-medium tracking-wide text-zinc-200">
                    {asset.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Fizyka (Scenografia)</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {locationAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => !readOnly && setSelectedLocationId(asset.id)}
                  disabled={readOnly}
                  className={`group relative aspect-video overflow-hidden rounded-lg border-2 transition-all duration-200 ${
                    selectedLocationId === asset.id
                      ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                      : 'border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <img
                    src={assetImagePath(asset)}
                    alt={asset.name}
                    className="h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-100"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 pt-6 text-center text-[10px] font-medium tracking-wide text-zinc-200">
                    {asset.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Override (Kamera)</h3>
            <textarea
              value={compositionText}
              onChange={(e) => !readOnly && setCompositionText(e.target.value)}
              readOnly={readOnly}
              placeholder="Instrukcje dla modelu (ujęcie z dołu, makro, dym, agresywny ruch)…"
              className="h-24 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-300 placeholder-zinc-600 transition-colors focus:border-zinc-500 focus:bg-zinc-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-start">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-zinc-600">Podgląd 0 zł</p>
          <div
            className="relative w-full max-w-[200px] overflow-hidden rounded-lg border border-zinc-800 bg-black"
            style={{ aspectRatio: '9 / 16' }}
          >
            {preview?.data ? (
              <img src={preview.data} alt="Podgląd kolażu" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center text-[10px] text-zinc-600">
                {loading ? 'Składanie…' : 'Wybierz aktora i tło'}
              </div>
            )}
            {loading && preview?.data && (
              <span className="absolute right-1 top-1 rounded bg-zinc-900/90 px-1.5 py-0.5 text-[9px] text-amber-300">…</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-zinc-800/50 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={readOnly || !selectedCharacterId || !selectedLocationId || saving}
          className="rounded-md bg-zinc-200 px-6 py-2 text-xs font-bold uppercase tracking-wider text-zinc-950 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          {saving ? 'Zapisuję…' : 'Zablokuj Parametry Sceny'}
        </button>
      </div>
    </div>
  );
}
