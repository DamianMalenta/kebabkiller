import { useEffect, useState } from 'react';
import { api, getOwnerToken, setOwnerToken } from '../api/client.js';

const STATUS_STYLE = {
  proposed: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  applied: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rolled_back: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  reverted: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLE[status] || 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default function SystemAgent() {
  const [token, setToken] = useState(getOwnerToken());
  const [enabled, setEnabled] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ title: '', problem: '', path: '', after: '' });
  const [diagnosis, setDiagnosis] = useState(null);
  const [lastProposed, setLastProposed] = useState(null);

  useEffect(() => {
    api.systemAgent.health().then((h) => setEnabled(h.enabled)).catch(() => setEnabled(false));
  }, []);

  async function refresh() {
    setError('');
    try {
      setRepairs(await api.systemAgent.listRepairs());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    if (getOwnerToken()) refresh();
  }, []);

  function saveToken() {
    setOwnerToken(token.trim());
    refresh();
  }

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      return await fn();
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onDiagnose() {
    const result = await run(() =>
      api.systemAgent.diagnose({ problem: form.problem, files: form.path ? [form.path] : [] }),
    );
    if (result) setDiagnosis(result);
  }

  async function onPropose() {
    const result = await run(() =>
      api.systemAgent.propose({
        title: form.title || 'Naprawa AI-Inżyniera',
        problem: form.problem,
        diagnosis,
        changes: [{ path: form.path, after: form.after }],
      }),
    );
    if (result) {
      setLastProposed(result);
      refresh();
    }
  }

  async function onApply(id) {
    const result = await run(() => api.systemAgent.apply(id));
    if (result) {
      if (result.applied === false) {
        setError(`Testy czerwone — auto-rollback. ${result.test_summary || ''}`);
      }
      refresh();
    }
  }

  async function onUndo(id) {
    if (!window.confirm('Cofnąć tę naprawę? Pliki wrócą do stanu sprzed zmiany.')) return;
    await run(() => api.systemAgent.undo(id));
    refresh();
  }

  if (enabled === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-amber-400">AI-Inżynier Studia</h1>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Moduł wyłączony. Ustaw <code className="rounded bg-zinc-900 px-1">SYSTEM_AGENT_TOKEN</code> w
          <code className="rounded bg-zinc-900 px-1">backend/.env</code> i zrestartuj backend.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-amber-400">AI-Inżynier Studia</h1>
        <p className="text-sm text-zinc-500">
          Pętla naprawcza z checkpointem git, bramką testów i cofaniem. Tylko za tokenem właściciela.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <label className="mb-1 block text-sm font-medium text-zinc-300">Token właściciela</label>
        <div className="flex gap-2">
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="x-owner-token"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          <button onClick={saveToken} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950">
            Zapisz
          </button>
        </div>
      </section>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-200">Nowa naprawa</h2>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Tytuł (np. Napraw literówkę w wanConfig)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <textarea
          value={form.problem}
          onChange={(e) => setForm({ ...form, problem: e.target.value })}
          placeholder="Opis problemu"
          rows={2}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
        <input
          value={form.path}
          onChange={(e) => setForm({ ...form, path: e.target.value })}
          placeholder="Ścieżka pliku (np. backend/src/video/wanConfig.js)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100"
        />
        <textarea
          value={form.after}
          onChange={(e) => setForm({ ...form, after: e.target.value })}
          placeholder="Nowa zawartość pliku (after)"
          rows={6}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onDiagnose}
            disabled={busy}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Diagnozuj (read-only)
          </button>
          <button
            onClick={onPropose}
            disabled={busy || !form.path || !form.after}
            className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            Zaproponuj
          </button>
          {lastProposed?.status === 'proposed' && (
            <button
              onClick={() => onApply(lastProposed.id)}
              disabled={busy}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              Zastosuj „{lastProposed.title}"
            </button>
          )}
        </div>
        {diagnosis && (
          <pre className="max-h-48 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
            {JSON.stringify(diagnosis, null, 2)}
          </pre>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Dziennik Napraw</h2>
          <button onClick={refresh} className="text-xs text-zinc-400 hover:text-zinc-200">Odśwież</button>
        </div>
        {repairs.length === 0 && <p className="text-sm text-zinc-500">Brak wpisów.</p>}
        <ul className="space-y-2">
          {repairs.map((r) => (
            <li key={r.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">{r.title}</p>
                  <p className="truncate text-xs text-zinc-500">{r.files.map((f) => f.path).join(', ')}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={r.status} />
                  {r.status === 'proposed' && (
                    <button onClick={() => onApply(r.id)} disabled={busy} className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-zinc-950 disabled:opacity-50">
                      Zastosuj
                    </button>
                  )}
                  {r.status === 'applied' && (
                    <button onClick={() => onUndo(r.id)} disabled={busy} className="rounded-lg border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50">
                      Cofnij
                    </button>
                  )}
                </div>
              </div>
              {r.test_summary && <p className="mt-1 text-xs text-zinc-500">Testy: {r.test_summary}</p>}
              {r.error && <p className="mt-1 text-xs text-red-400">{r.error}</p>}
              {r.diff_text && (
                <pre className="mt-2 max-h-40 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-400">
                  {r.diff_text}
                </pre>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
