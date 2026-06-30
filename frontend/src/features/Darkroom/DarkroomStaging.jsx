import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { darkroomPath } from '../../lib/deskRoutes.js';

const PENDING = 'PENDING_USER_APPROVAL';

export default function DarkroomStaging({ episodePlanId, projectId }) {
  const [queue, setQueue] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const current = queue[0] ?? null;

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.darkroom.getAssets(episodePlanId);
      const pending = (data.scene_assets || []).filter((a) => a.status === PENDING);
      setQueue(pending);
      setPrompt(pending[0]?.ai_proposed_prompt || '');
    } catch (err) {
      setError(err.message);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, [episodePlanId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    setPrompt(current?.ai_proposed_prompt || '');
  }, [current?.id]);

  async function review(status) {
    if (!current || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.darkroom.reviewAsset(current.id, status, prompt);
      await loadQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-center text-zinc-500">Ładuję poczekalnię…</p>;
  }

  if (queue.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 text-center">
        <div className="border border-zinc-800 bg-zinc-950/60 px-8 py-10">
          <p className="text-lg font-bold uppercase tracking-wider text-zinc-300">
            Poczekalnia pusta
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Brak kadrów oczekujących na zatwierdzenie. Sprawdź sceny i bramkę produkcji GPU.
          </p>
          {projectId && (
            <Link
              to={darkroomPath(projectId, episodePlanId, 'scenes')}
              className="mt-4 inline-block rounded border border-amber-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-400 hover:bg-amber-950/40"
            >
              Przejdź do scen
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-zinc-200">Poczekalnia</h1>
        <span className="text-sm text-zinc-500">
          {queue.length} w kolejce
        </span>
      </div>

      <div className="overflow-hidden border border-zinc-800 bg-black">
        <img
          src={current.raw_image_path}
          alt="Surowa klatka"
          className="mx-auto max-h-[55vh] w-full object-contain"
        />
      </div>

      <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-widest text-zinc-500">
          Prompt (AI + Twoja edycja)
        </span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          disabled={busy}
          className="w-full resize-y border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-200 outline-none focus:border-zinc-500"
        />
      </label>

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => review('REJECTED')}
          className="border-2 border-red-700 bg-red-950 py-6 text-lg font-black uppercase tracking-wider text-red-400 hover:bg-red-900 disabled:opacity-50"
        >
          Odrzuć
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => review('APPROVED')}
          className="border-2 border-emerald-700 bg-emerald-950 py-6 text-lg font-black uppercase tracking-wider text-emerald-400 hover:bg-emerald-900 disabled:opacity-50"
        >
          Zatwierdź
        </button>
      </div>
    </div>
  );
}
