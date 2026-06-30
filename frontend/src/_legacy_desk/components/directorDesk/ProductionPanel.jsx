import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../api/client.js';

const STATUS_LABELS = {
  pending: 'Oczekuje',
  running: 'W trakcie',
  completed: 'Gotowe',
  failed: 'Błąd',
  partial: 'Częściowo',
  rendering: 'Renderuje',
};

function clipStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export default function ProductionPanel({
  episodePlanId,
  planStatus,
  onRefresh,
  scrollRef,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [producing, setProducing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!episodePlanId) return;
    try {
      const result = await api.episodePlans.production(episodePlanId);
      setData(result);
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
    const active = run?.status === 'running' || run?.clips?.some((c) => c.status === 'rendering');
    if (!active) return undefined;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [data, load]);

  async function handleProduce() {
    setProducing(true);
    setError('');
    try {
      await api.episodePlans.produce(episodePlanId);
      await load();
      onRefresh?.();
      scrollRef?.current?.scrollIntoView({ behavior: 'smooth' });
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
      onRefresh?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setResuming(false);
    }
  }

  const frozen = ['zaakceptowany', 'w_produkcji', 'gotowy'].includes(planStatus);
  if (!episodePlanId || !frozen) return null;

  const run = data?.production;
  const canProduce = planStatus === 'zaakceptowany' && !run?.status?.match(/running/);
  const canResume = run && (run.status === 'partial' || run.status === 'failed');

  return (
    <section
      ref={scrollRef}
      className="mb-6 rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4"
      id="production-panel"
    >
      <h2 className="text-lg font-semibold text-emerald-300">Produkcja</h2>
      <p className="mt-1 text-xs text-zinc-500">Silnik: RunComfy (domyślny)</p>

      {error && (
        <p className="mt-2 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {loading && !run && (
        <p className="mt-3 text-sm text-zinc-400">Ładowanie statusu produkcji…</p>
      )}

      {run && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-zinc-300">
            Status runu: <span className="font-medium text-emerald-200">{clipStatusLabel(run.status)}</span>
            {run.progress != null && ` · ${run.progress}%`}
          </p>
          {run.error_message && (
            <p className="text-sm text-red-300">{run.error_message}</p>
          )}
          <ul className="space-y-2">
            {(run.clips || []).map((clip) => (
              <li
                key={clip.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm"
              >
                <span className="text-zinc-200">{clip.clip_code || clip.id.slice(0, 8)}</span>
                <span className="text-zinc-400">{clipStatusLabel(clip.status)}</span>
                {clip.output_path && (
                  <a
                    href={clip.output_path}
                    download
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-emerald-500"
                  >
                    Pobierz WEBM
                  </a>
                )}
                {clip.error_message && (
                  <span className="w-full text-xs text-red-400">{clip.error_message}</span>
                )}
              </li>
            ))}
          </ul>
          {(run.status === 'completed' || run.status === 'partial') && (
            <a
              href={`/api/production-runs/${run.id}/export.zip`}
              className="inline-block rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-950"
            >
              Pobierz paczkę odcinka (ZIP)
            </a>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canProduce && (
          <button
            type="button"
            disabled={producing}
            onClick={handleProduce}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {producing ? 'Uruchamianie…' : 'Uruchom produkcję (RunComfy)'}
          </button>
        )}
        {canResume && (
          <button
            type="button"
            disabled={resuming}
            onClick={handleResume}
            className="rounded-lg border border-amber-600 px-4 py-2 text-sm text-amber-300 hover:bg-amber-950 disabled:opacity-50"
          >
            {resuming ? 'Wznawianie…' : 'Resume (brakujące sceny)'}
          </button>
        )}
      </div>
    </section>
  );
}
