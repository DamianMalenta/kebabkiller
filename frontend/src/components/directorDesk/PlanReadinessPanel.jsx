import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import CostGuardBanner from './CostGuardBanner.jsx';

function sceneFrameConfirmed(scene) {
  try {
    const raw = scene.ai_overrides_json ?? scene.ai_overrides;
    const o = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    return o.composite?.frame_confirmed === true;
  } catch {
    return false;
  }
}

export default function PlanReadinessPanel({
  episodePlanId,
  planStatus,
  logline = '',
  scenes = [],
  onAccepted,
  onProductionStarted,
}) {
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [assistPreview, setAssistPreview] = useState(null);
  const [costAck, setCostAck] = useState(false);

  const load = useCallback(async () => {
    if (!episodePlanId) return;
    try {
      const v = await api.episodePlans.validate(episodePlanId);
      setValidation(v);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [episodePlanId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, scenes.length, planStatus]);

  const frozen = ['zaakceptowany', 'w_produkcji', 'gotowy'].includes(planStatus);

  async function handleAccept(startProduction) {
    if (startProduction && !costAck) {
      setError('Zaznacz potwierdzenie kosztu RunComfy przed produkcją.');
      return;
    }
    if (startProduction && !framesReady) {
      setError('Przed produkcją zapisz Klatkę Zero dla każdej sceny (panel Tożsamość → Zapisz).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.episodePlans.accept(episodePlanId, { startProduction });
      await load();
      onAccepted?.(result);
      if (result.production_started) {
        onProductionStarted?.();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssist(apply) {
    setBusy(true);
    setError('');
    try {
      const result = await api.episodePlans.assist(episodePlanId, {
        message: 'Zaproponuj plan odcinka na podstawie logline i dostępnych assetów w kanonie.',
        apply,
      });
      if (apply) {
        setAssistPreview(null);
        await load();
        onAccepted?.();
      } else {
        setAssistPreview(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!episodePlanId) return null;

  const checks = [
    { ok: Boolean(logline?.trim()), label: 'Logline' },
    { ok: (scenes?.length ?? 0) >= 1, label: 'Min. 1 scena' },
    {
      ok: scenes.every((s) => s.asset_id && s.location_asset_id && s.description_pl?.trim()),
      label: 'Każda scena: postać + lokacja + opis',
    },
    {
      ok: scenes.length === 0 || scenes.every((s) => sceneFrameConfirmed(s)),
      label: 'Klatka Zero zapisana (Zapisz w panelu Tożsamość)',
    },
    { ok: validation?.ok === true, label: 'Walidator kodu' },
  ];

  const framesReady = scenes.length > 0 && scenes.every((s) => sceneFrameConfirmed(s));

  return (
    <section className="mb-6 rounded-xl border border-amber-800/40 bg-amber-950/15 p-4">
      <h2 className="text-lg font-semibold text-amber-300">Gotowość planu</h2>

      {error && (
        <p className="mt-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <p className="mt-2 text-sm text-zinc-400">Sprawdzam plan…</p>
      ) : (
        <>
          <ul className="mt-3 space-y-1 text-sm">
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? 'text-emerald-400' : 'text-zinc-400'}>
                {c.ok ? '✓' : '○'} {c.label}
              </li>
            ))}
          </ul>

          {validation?.errors?.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-red-300">
              {validation.errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}

          {!frozen && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !validation?.ok}
                onClick={() => handleAccept(false)}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
              >
                Akceptuj plan
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAssist(false)}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                Pomóż z planem (AI)
              </button>
            </div>
          )}

          {!frozen && validation?.ok && (
            <div className="mt-4 space-y-3">
              <CostGuardBanner
                sceneCount={scenes.length}
                totalSec={scenes.reduce((a, s) => a + (s.duration_sec || 0), 0)}
                acknowledged={costAck}
                onAcknowledgeChange={setCostAck}
              />
              <button
                type="button"
                disabled={busy || !costAck}
                onClick={() => handleAccept(true)}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Akceptuj i produkuj (RunComfy)
              </button>
            </div>
          )}

          {assistPreview?.proposal && (
            <div className="mt-4 rounded-lg border border-sky-800/50 bg-sky-950/20 p-3 text-sm">
              <p className="font-medium text-sky-200">Propozycja Scenarzysty</p>
              <pre className="mt-2 max-h-40 overflow-auto text-xs text-zinc-300 whitespace-pre-wrap">
                {JSON.stringify(assistPreview.proposal, null, 2)}
              </pre>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAssist(true)}
                className="mt-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-zinc-950"
              >
                Zastosuj propozycję
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
