import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ProjectEditor from '../components/ProjectEditor.jsx';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [episodes, setEpisodes] = useState([]);
  const navigate = useNavigate();

  const refreshProject = useCallback(async (id) => {
    const fresh = await api.projects.get(id);
    setProjects((prev) => prev.map((p) => (p.id === id ? fresh : p)));
    const eps = await api.projects.episodes(id);
    setEpisodes(eps);
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
          Projekty, Style Bible i odcinki. Pamięć serialowa rośnie po zatwierdzeniu kanonu w Stole Reżyserskim.
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
            {selectedProject && !isCreatingNew && (
              <div className="rounded-xl border border-amber-800/30 bg-amber-950/10 p-6 text-center shadow-lg md:text-left md:flex md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-amber-500">Przejdź do produkcji</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    W Stole Reżyserskim zaplanujesz odcinki, stworzysz z agentem scenariusze i wyślesz je prosto na karty graficzne do renderu.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/desk/${selectedProject.id}`)}
                  className="mt-4 md:mt-0 inline-flex items-center justify-center rounded-xl bg-amber-500 px-6 py-3 font-bold text-zinc-950 shadow-md transition-transform hover:scale-105 hover:bg-amber-400 active:scale-95"
                >
                  🎬 Otwórz Stół Reżyserski
                </button>
              </div>
            )}
            
            {!isCreatingNew && selectedProject && episodes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-bold text-zinc-300 mb-4">Lista Odcinków</h3>
                {episodes.some((e) => e.status === 'w_produkcji') && (
                  <p className="mb-3 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
                    Ostrzeżenie: odcinek w produkcji — jeśli utknął, otwórz Reżyserię i użyj panelu Produkcja (Resume).
                  </p>
                )}
                {episodes.filter((e) => !(e.scenes?.length)).length > 0 && (
                  <p className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-400">
                    Niektóre odcinki mają 0 scen — usuń duplikaty lub dokończ plan w Reżyserii.
                  </p>
                )}
                <div className="grid gap-3">
                  {episodes.map((ep) => (
                    <div
                      key={ep.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/desk/${selectedProject.id}?episode=${ep.id}`)}
                        className="min-w-0 flex-1 text-left transition hover:opacity-90"
                      >
                        <p className="font-bold text-amber-500">{ep.code}</p>
                        <p className="text-sm text-zinc-300">{ep.title || 'Szkic'}</p>
                        <p className="text-xs text-zinc-500">{ep.scenes?.length ?? 0} scen</p>
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="inline-block rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                          {ep.status}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Usunąć odcinek ${ep.code}?`)) return;
                            try {
                              await api.episodePlans.delete(ep.id);
                              await refreshProject(selectedProject.id);
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                          className="rounded-lg border border-red-900 px-2 py-1 text-xs text-red-400 hover:bg-red-950"
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
