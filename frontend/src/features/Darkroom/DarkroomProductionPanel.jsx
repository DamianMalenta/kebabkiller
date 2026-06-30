import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const FROZEN_PLAN_STATUSES = new Set(['zaakceptowany', 'w_produkcji', 'gotowy']);

const PLAN_STATUS_LABELS = {
  szkic: 'Szkic',
  gotowy_do_akceptacji: 'Gotowy do akceptacji',
  brakuje_materialow: 'Braki materiałów',
  zaakceptowany: 'Zaakceptowany',
  w_produkcji: 'W produkcji',
  gotowy: 'Gotowy',
};

const RUN_STATUS_LABELS = {
  pending: 'Oczekuje',
  running: 'W trakcie',
  completed: 'Gotowe',
  failed: 'Błąd',
  partial: 'Częściowo',
};

function planStatusLabel(status) {
  return PLAN_STATUS_LABELS[status] || status || '—';
}

function runStatusLabel(status) {
  return RUN_STATUS_LABELS[status] || status || '—';
}

export function finalEpisodePathFromRun(run) {
  return run?.final_episode_path || run?.finalEpisodePath || null;
}

export function FinalEpisodeDownloadLink({ href, className = '' }) {
  if (!href) return null;
  return (
    <a
      href={href}
      download
      className={`inline-block rounded-lg border-2 border-yellow-500 bg-zinc-900 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-yellow-500 hover:bg-yellow-500/10 ${className}`}
    >
      Pobierz gotowy odcinek
    </a>
  );
}

export default function DarkroomProductionPanel({ episodePlanId }) {
  const [data, setData] = useState(null);
  const [validation, setValidation] = useState(null);
  const [productionGate, setProductionGate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [producing, setProducing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!episodePlanId) return;
    try {
      const [prod, val, gate] = await Promise.all([
        api.episodePlans.production(episodePlanId),
        api.episodePlans.validate(episodePlanId),
        api.episodePlans.productionGate(episodePlanId),
      ]);
      setData(prod);
      setValidation(val);
      setProductionGate(gate);
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
  }, [load]);

  useEffect(() => {
    const run = data?.production;
    const active = run?.status === 'running' || run?.status === 'pending'
      || run?.clips?.some((c) => c.status === 'rendering');
    if (!active) return undefined;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [data, load]);

  async function handleAccept() {
    setAccepting(true);
    setError('');
    try {
      await api.episodePlans.accept(episodePlanId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  }

  async function handleProduce() {
    setProducing(true);
    setError('');
    try {
      await api.episodePlans.produce(episodePlanId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setProducing(false);
    }
  }

  async function handleResume() {
    const runId = data?.production?.id;
    if (!runId) return;
    setResuming(true);
    setError('');
    try {
      await api.episodePlans.resumeProduction(runId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setResuming(false);
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-zinc-500">Ładowanie statusu produkcji…</p>;
  }

  const planStatus = data?.plan_status;
  const run = data?.production;
  const finalEpisodePath = finalEpisodePathFromRun(run);
  const isFrozen = FROZEN_PLAN_STATUSES.has(planStatus);
  const gateOk = productionGate?.ok === true;
  const gateErrors = productionGate?.errors || [];
  const canAccept = !isFrozen && validation?.ok;
  const isActive = run?.status === 'running' || run?.status === 'pending';
  const canResume = run && (run.status === 'partial' || run.status === 'failed') && !isActive;
  const canProduce = planStatus === 'zaakceptowany'
    && gateOk
    && !isActive
    && !canResume;
  const progress = run?.progress ?? 0;
  const isComplete = run?.status === 'completed' && finalEpisodePath;
  const readyForProduction = gateOk && validation?.ok;

  return (
    <div className="mx-auto max-w-3xl space-y-4 border border-zinc-800 bg-zinc-950/60 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Produkcja GPU</h2>
        <span className="text-xs text-zinc-500">
          Plan: {planStatusLabel(planStatus)}
          {run && ` · Run: ${runStatusLabel(run.status)}${run.progress != null ? ` · ${run.progress}%` : ''}`}
        </span>
      </div>

      {error && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {run?.error_message && (
        <p className="text-sm text-red-300">{run.error_message}</p>
      )}

      {readyForProduction && !isFrozen && (
        <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          Wszystkie sceny gotowe — możesz zaakceptować plan i uruchomić produkcję GPU.
        </p>
      )}

      {!gateOk && gateErrors.length > 0 && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          <p className="font-semibold uppercase tracking-wide text-xs text-red-400">
            Braki przed produkcją GPU
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-red-100/90">
            {gateErrors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {!isFrozen && validation && !validation.ok && validation.errors?.length > 0 && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          <p className="font-semibold uppercase tracking-wide text-xs text-amber-400">Przed akceptacją planu</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-amber-100/90">
            {validation.errors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {!isFrozen && validation?.warnings?.length > 0 && (
        <ul className="text-xs text-zinc-500">
          {validation.warnings.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}

      {(isActive || run?.status === 'completed') && (
        <div className="space-y-2">
          <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className="text-center text-xs uppercase tracking-wider text-zinc-500">
            {progress}% ukończone
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {canAccept && (
          <button
            type="button"
            disabled={accepting}
            onClick={handleAccept}
            className="rounded-lg border-2 border-amber-500 bg-zinc-900 px-6 py-3 text-sm font-black uppercase tracking-wider text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
          >
            {accepting ? 'Akceptuję…' : 'Zaakceptuj plan odcinka'}
          </button>
        )}
        {canProduce && (
          <button
            type="button"
            disabled={producing}
            onClick={handleProduce}
            className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {producing ? 'Uruchamianie…' : 'Produkuj odcinek'}
          </button>
        )}
        {canResume && (
          <button
            type="button"
            disabled={resuming}
            onClick={handleResume}
            className="rounded-lg border-2 border-amber-500 bg-zinc-900 px-6 py-3 text-sm font-black uppercase tracking-wider text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
          >
            {resuming ? 'Wznawiam…' : 'Wznawiaj produkcję'}
          </button>
        )}
        {isComplete && <FinalEpisodeDownloadLink href={finalEpisodePath} />}
      </div>
    </div>
  );
}
