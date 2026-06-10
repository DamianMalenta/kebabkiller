import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function EpisodeList({ projectId, onChange }) {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editNumber, setEditNumber] = useState('');
  const [editTitle, setEditTitle] = useState('');

  async function loadEpisodes() {
    if (!projectId) {
      setEpisodes([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.projects.episodes(projectId);
      setEpisodes(data);
      onChange?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setEditingId(null);
    loadEpisodes();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    if (episodes.length === 0) {
      setEpisodeNumber('1');
      return;
    }
    const max = Math.max(...episodes.map((e) => e.episode_number));
    setEpisodeNumber(String(max + 1));
  }, [episodes, projectId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!projectId) return;
    const num = Number(episodeNumber);
    if (!Number.isInteger(num) || num < 1) {
      setError('Numer odcinka musi być liczbą całkowitą większą od 0.');
      return;
    }
    if (!title.trim()) {
      setError('Tytuł odcinka jest wymagany.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.projects.createEpisode(projectId, {
        episode_number: num,
        title: title.trim(),
      });
      setTitle('');
      await loadEpisodes();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(episode) {
    if (!window.confirm(`Usunąć odcinek ${episode.episode_number}: „${episode.title}"?`)) return;
    setError('');
    try {
      await api.episodes.delete(episode.id);
      if (editingId === episode.id) setEditingId(null);
      await loadEpisodes();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(episode) {
    setEditingId(episode.id);
    setEditNumber(String(episode.episode_number));
    setEditTitle(episode.title);
  }

  async function handleSaveEdit(episodeId) {
    setSaving(true);
    setError('');
    try {
      await api.episodes.update(episodeId, {
        episode_number: Number(editNumber),
        title: editTitle.trim(),
      });
      setEditingId(null);
      await loadEpisodes();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!projectId) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="font-semibold">Odcinki</h2>
        <p className="mt-2 text-sm text-zinc-500">Zapisz projekt, aby dodać odcinki.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
      <h2 className="font-semibold">Odcinki</h2>

      {error && <p className="rounded-lg bg-red-950 p-2 text-sm text-red-300">{error}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Ładowanie odcinków…</p>
      ) : episodes.length === 0 ? (
        <p className="text-sm text-zinc-500">Brak odcinków — dodaj pierwszy poniżej.</p>
      ) : (
        <ul className="space-y-2">
          {episodes.map((ep) => (
            <li
              key={ep.id}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            >
              {editingId === ep.id ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block">
                    <span className="text-xs text-zinc-500">Numer</span>
                    <input
                      type="number"
                      min="1"
                      value={editNumber}
                      onChange={(e) => setEditNumber(e.target.value)}
                      className="mt-1 w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1"
                    />
                  </label>
                  <label className="block flex-1 min-w-[12rem]">
                    <span className="text-xs text-zinc-500">Tytuł</span>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveEdit(ep.id)}
                    className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950 disabled:opacity-50"
                  >
                    Zapisz
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-zinc-600 px-3 py-1 text-xs hover:bg-zinc-800"
                  >
                    Anuluj
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-zinc-200">
                    <span className="text-zinc-500">#{ep.episode_number}</span> {ep.title}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(ep)}
                      className="rounded-lg border border-zinc-700 px-2 py-0.5 text-xs hover:bg-zinc-800"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ep)}
                      className="rounded-lg border border-red-900 px-2 py-0.5 text-xs text-red-300 hover:bg-red-950"
                    >
                      Usuń
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 border-t border-zinc-800 pt-4">
        <label className="block">
          <span className="text-xs text-zinc-500">Numer odcinka</span>
          <input
            type="number"
            min="1"
            required
            value={episodeNumber}
            onChange={(e) => setEpisodeNumber(e.target.value)}
            placeholder="1"
            className="mt-1 w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block flex-1 min-w-[12rem]">
          <span className="text-xs text-zinc-500">Tytuł</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Np. Skok z pieca"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? 'Dodaję…' : 'Dodaj odcinek'}
        </button>
      </form>
    </div>
  );
}
