import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { darkroomPath } from '../lib/deskRoutes.js';

const STATUS_LABELS = {
  szkic: 'Szkic',
  gotowy_do_akceptacji: 'Gotowy',
  brakuje_materialow: 'Braki',
  zaakceptowany: 'Zaakceptowany',
  w_produkcji: 'W produkcji',
  gotowy: 'Gotowy',
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '—';
}

function CreateEpisodeModal({ open, onClose, onCreate, busy, error }) {
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');

  useEffect(() => {
    if (!open) {
      setTitle('');
      setLogline('');
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onCreate({ title: trimmedTitle, logline: logline.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-episode-title"
      >
        <h2 id="create-episode-title" className="text-lg font-bold text-zinc-100">
          Nowy odcinek
        </h2>
        <p className="mt-1 text-sm text-zinc-500">Tytuł i zarys fabuły — reszta w Kinowej Ciemni.</p>

        {error && (
          <p className="mt-3 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Tytuł</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Pierwsza Krew"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
              autoFocus
              disabled={busy}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Zarys fabuły</span>
            <textarea
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              placeholder="Krótko: co się dzieje w tym odcinku?"
              rows={4}
              className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
              disabled={busy}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? 'Tworzę…' : 'Utwórz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StudioDashboard() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadEpisodes = useCallback(async () => {
    const list = await api.episodePlans.list(projectId);
    setEpisodes(list || []);
  }, [projectId]);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [proj] = await Promise.all([
        api.projects.get(projectId),
        loadEpisodes(),
      ]);
      setProject(proj);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, loadEpisodes]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate({ title, logline }) {
    setCreating(true);
    setCreateError('');
    try {
      await api.projects.createEpisodePlan(projectId, { title, logline });
      setModalOpen(false);
      await loadEpisodes();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (loading && !project) {
    return <p className="text-zinc-400">Ładowanie pulpitu studia…</p>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Studio</p>
          <h1 className="text-2xl font-bold text-zinc-100">{project?.name || 'Projekt'}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Utwórz odcinek → wejdź do Kinowej Ciemni.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/projects"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            ← Seriale
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreateError('');
              setModalOpen(true);
            }}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold uppercase tracking-wide text-zinc-950 hover:bg-amber-400"
          >
            + Nowy odcinek
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3 font-semibold">Kod</th>
              <th className="px-4 py-3 font-semibold">Tytuł</th>
              <th className="px-4 py-3 font-semibold">Zarys</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Akcja</th>
            </tr>
          </thead>
          <tbody>
            {episodes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                  Brak odcinków. Kliknij <strong className="text-zinc-300">+ Nowy odcinek</strong>.
                </td>
              </tr>
            )}
            {episodes.map((ep) => (
              <tr key={ep.id} className="border-b border-zinc-800/80 hover:bg-zinc-900/40">
                <td className="px-4 py-4 font-mono text-amber-400">{ep.code}</td>
                <td className="px-4 py-4 font-medium text-zinc-200">{ep.title || '—'}</td>
                <td className="max-w-xs truncate px-4 py-4 text-zinc-400" title={ep.logline || ''}>
                  {ep.logline || '—'}
                </td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                    {statusLabel(ep.status)}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => navigate(darkroomPath(projectId, ep.id))}
                    className="rounded-lg border-2 border-zinc-600 bg-zinc-900 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-zinc-100 hover:border-zinc-400 hover:bg-zinc-800"
                  >
                    Wejdź do Kinowej Ciemni
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateEpisodeModal
        open={modalOpen}
        onClose={() => !creating && setModalOpen(false)}
        onCreate={handleCreate}
        busy={creating}
        error={createError}
      />
    </div>
  );
}
