import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ProjectEditor from '../components/ProjectEditor.jsx';
import EpisodeList from '../components/EpisodeList.jsx';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refreshProject = useCallback(async (id) => {
    const fresh = await api.projects.get(id);
    setProjects((prev) => prev.map((p) => (p.id === id ? fresh : p)));
    return fresh;
  }, []);

  async function loadProjects(preferredId) {
    setError('');
    setLoading(true);
    try {
      const data = await api.projects.list();
      if (data.length === 0) {
        setProjects([]);
        setSelectedId(null);
        setIsCreatingNew(true);
        return;
      }

      setProjects(data);
      const targetId =
        preferredId && data.some((p) => p.id === preferredId)
          ? preferredId
          : selectedId && data.some((p) => p.id === selectedId)
            ? selectedId
            : data[0].id;

      setSelectedId(targetId);
      setIsCreatingNew(false);
      setLoadingDetail(true);
      await refreshProject(targetId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingDetail(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;

  async function handleSaved(saved) {
    setMessage(isCreatingNew ? 'Projekt utworzony.' : 'Projekt zapisany.');
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx === -1) return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setSelectedId(saved.id);
    setIsCreatingNew(false);
    try {
      await refreshProject(saved.id);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDeleted(id) {
    setMessage('Projekt usunięty.');
    const remaining = projects.filter((p) => p.id !== id);
    setProjects(remaining);
    if (remaining.length === 0) {
      setSelectedId(null);
      setIsCreatingNew(true);
    } else {
      setSelectedId(remaining[0].id);
      refreshProject(remaining[0].id).catch((err) => setError(err.message));
    }
  }

  async function handleSelect(id) {
    setSelectedId(id);
    setIsCreatingNew(false);
    setMessage('');
    setError('');
    setLoadingDetail(true);
    try {
      await refreshProject(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleNewProject() {
    setIsCreatingNew(true);
    setSelectedId(null);
    setMessage('');
    setError('');
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Panel Sterowania Seriali</h1>
        <p className="mt-2 text-zinc-400">
          Projekty, Style Bible i odcinki — bez Postmana. Pamięć serialowa rośnie po zatwierdzeniu kanonu na Dashboardzie.
        </p>
      </header>

      {error && <p className="rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}
      {message && <p className="rounded-lg bg-emerald-950 p-3 text-emerald-300">{message}</p>}

      {loading ? (
        <p className="text-zinc-500">Ładowanie projektów…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(12rem,16rem)_1fr]">
          <aside className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-300">Projekty</h2>
              <button
                type="button"
                onClick={handleNewProject}
                className="rounded-lg bg-amber-500 px-2 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
              >
                + Nowy
              </button>
            </div>

            {projects.length === 0 && !isCreatingNew && (
              <p className="text-xs text-zinc-500">Brak projektów. Kliknij „+ Nowy”.</p>
            )}

            <ul className="space-y-1">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(p.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      selectedId === p.id && !isCreatingNew
                        ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="space-y-6">
            {loadingDetail && !isCreatingNew && (
              <p className="text-sm text-zinc-500">Odświeżam szczegóły projektu…</p>
            )}
            <ProjectEditor
              project={selectedProject}
              isNew={isCreatingNew}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onCancelNew={() => {
                setIsCreatingNew(false);
                if (projects[0]) handleSelect(projects[0].id);
              }}
            />
            <EpisodeList projectId={isCreatingNew ? null : selectedId} />
          </div>
        </div>
      )}
    </div>
  );
}
