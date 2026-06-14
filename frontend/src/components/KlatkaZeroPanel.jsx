import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';

const DEFAULT_COMPOSITE = { scale: 0.52, heightScale: 0.42, position: { x: 0.5, y: 0.9 } };

// Źródła klatki startowej (sekcja C). AI-gen = GPU → odłożone do lekkiego deploymentu RunComfy.
const SOURCES = [
  { value: 'compose', label: 'Składaj @char + @loc', enabled: true },
  { value: 'upload', label: 'Upload gotowej klatki', enabled: true },
  { value: 'library', label: 'Klatka z biblioteki', enabled: true },
  { value: 'ai', label: 'Generuj AI (GPU — odłożone)', enabled: false },
];

/**
 * Panel Klatki Zero (Faza C, 0 zł / zero GPU):
 * steruje pozycją i skalą @char na tle @loc, podgląd kolażu na żywo, zapis kaskady
 * (override sceny → domyślna assetu). Wybór źródła; AI-gen wyłączone (GPU odłożone).
 */
export default function KlatkaZeroPanel({ characterAssets = [], locationAssets = [], planId = null, sceneId = null }) {
  const [characterAssetId, setCharacterAssetId] = useState(characterAssets[0]?.id || '');
  const [locationAssetId, setLocationAssetId] = useState(locationAssets[0]?.id || '');
  const [composite, setComposite] = useState(DEFAULT_COMPOSITE);
  const [source, setSource] = useState('compose');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const debounceRef = useRef(null);

  const selectedChar = useMemo(
    () => characterAssets.find((a) => a.id === characterAssetId) || null,
    [characterAssets, characterAssetId],
  );

  // Wczytaj domyślną composite assetu jako punkt startowy panelu.
  useEffect(() => {
    if (selectedChar?.composite_default) {
      setComposite({ ...DEFAULT_COMPOSITE, ...selectedChar.composite_default });
    } else {
      setComposite(DEFAULT_COMPOSITE);
    }
  }, [selectedChar]);

  const runPreview = useCallback(async () => {
    if (!characterAssetId && !locationAssetId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.composite.preview({
        characterAssetId: characterAssetId || undefined,
        locationAssetId: locationAssetId || undefined,
        sceneComposite: { ...composite, source },
      });
      setPreview(res);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [characterAssetId, locationAssetId, composite, source]);

  // Live preview z debounce (kolaż 0 zł).
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runPreview, 250);
    return () => clearTimeout(debounceRef.current);
  }, [runPreview]);

  function patchPosition(axis, value) {
    setComposite((c) => ({ ...c, position: { ...c.position, [axis]: Number(value) } }));
  }

  async function saveAssetDefault() {
    if (!characterAssetId) return;
    setMessage('');
    setError('');
    try {
      await api.assets.setCompositeDefault(characterAssetId, { ...composite, source });
      setMessage('Zapisano jako domyślną dla postaci (@char).');
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveSceneOverride() {
    if (!planId || !sceneId) return;
    setMessage('');
    setError('');
    try {
      await api.composite.setSceneOverride(planId, sceneId, { ...composite, source });
      setMessage('Zapisano override sceny (najwyższy priorytet kaskady).');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Klatka Zero — kolaż startowy</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Złóż postać na tle, ustaw pozycję i skalę. Podgląd jest darmowy (0 zł, bez GPU).
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">{error}</p>}
      {message && <p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-300">{message}</p>}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-zinc-400">Postać (@char)</span>
            <select
              value={characterAssetId}
              onChange={(e) => setCharacterAssetId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              <option value="">— wybierz —</option>
              {characterAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-zinc-400">Tło / lokacja (@loc)</span>
            <select
              value={locationAssetId}
              onChange={(e) => setLocationAssetId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              <option value="">— wybierz —</option>
              {locationAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-zinc-400">Źródło klatki</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value} disabled={!s.enabled}>{s.label}</option>
              ))}
            </select>
          </label>

          <Slider label={`Skala postaci: ${composite.scale.toFixed(2)}`} value={composite.scale} min={0.1} max={1} onChange={(v) => setComposite((c) => ({ ...c, scale: Number(v) }))} />
          <Slider label={`Pozycja X (poziom): ${composite.position.x.toFixed(2)}`} value={composite.position.x} min={0} max={1} onChange={(v) => patchPosition('x', v)} />
          <Slider label={`Pozycja Y (dół postaci): ${composite.position.y.toFixed(2)}`} value={composite.position.y} min={0} max={1} onChange={(v) => patchPosition('y', v)} />

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={saveAssetDefault}
              disabled={!characterAssetId}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              Zapisz jako domyślną (@char)
            </button>
            {planId && sceneId && (
              <button
                type="button"
                onClick={saveSceneOverride}
                className="rounded-lg border border-amber-600 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-zinc-900"
              >
                Zapisz override tej sceny
              </button>
            )}
            <button
              type="button"
              onClick={() => setComposite(DEFAULT_COMPOSITE)}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="relative w-[240px] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950" style={{ aspectRatio: '9 / 16' }}>
            {preview?.data ? (
              <img src={preview.data} alt="Podgląd Klatki Zero" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-xs text-zinc-600">
                {loading ? 'Składanie kolażu…' : 'Wybierz postać i tło, aby zobaczyć podgląd.'}
              </div>
            )}
            {loading && preview?.data && (
              <span className="absolute right-2 top-2 rounded bg-zinc-900/80 px-2 py-0.5 text-[10px] text-amber-300">…</span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">
            9:16 · 480×832 · {preview?.source ? `źródło: ${preview.source}` : 'podgląd 0 zł'}
          </p>
        </div>
      </div>
    </section>
  );
}

function Slider({ label, value, min, max, onChange }) {
  return (
    <label className="block text-sm">
      <span className="text-zinc-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full accent-amber-500"
      />
    </label>
  );
}
