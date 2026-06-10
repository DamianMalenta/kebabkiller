import { useEffect, useState } from 'react';
import { api, styleBibleToEditText } from '../api/client.js';
import SeriesMemoryPanel from './SeriesMemoryPanel.jsx';

export default function ProjectEditor({ project, isNew, onSaved, onDeleted, onCancelNew }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [styleBible, setStyleBible] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [memoryEditOpen, setMemoryEditOpen] = useState(false);
  const [seriesMemory, setSeriesMemory] = useState('');
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryMessage, setMemoryMessage] = useState('');

  useEffect(() => {
    if (isNew) {
      setName('');
      setDescription('');
      setStyleBible('');
      setSeriesMemory('');
      setMemoryEditOpen(false);
      setMemoryMessage('');
      return;
    }
    if (!project) return;
    setName(project.name || '');
    setDescription(project.description || '');
    setStyleBible(styleBibleToEditText(project));
    setSeriesMemory(project.series_memory || '');
    setMemoryEditOpen(false);
    setMemoryMessage('');
  }, [project, isNew]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        style_bible: styleBible.trim() || undefined,
      };
      const saved = isNew
        ? await api.projects.create(body)
        : await api.projects.update(project.id, body);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project?.id) return;
    if (!window.confirm(`Usunąć projekt „${project.name}"? Odcinki i powiązania zostaną usunięte.`)) return;
    setError('');
    try {
      await api.projects.delete(project.id);
      onDeleted?.(project.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveMemory() {
    if (!project?.id) return;
    setMemorySaving(true);
    setMemoryMessage('');
    setError('');
    try {
      const updated = await api.projects.update(project.id, { series_memory: seriesMemory });
      setSeriesMemory(updated.series_memory || '');
      setMemoryMessage('Pamięć serialowa zapisana.');
      setMemoryEditOpen(false);
      onSaved?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setMemorySaving(false);
    }
  }

  if (!isNew && !project) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-zinc-500">
        Wybierz projekt z listy lub utwórz nowy.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="font-semibold">{isNew ? 'Nowy projekt serialu' : `Edycja: ${project.name}`}</h2>

        {error && <p className="rounded-lg bg-red-950 p-3 text-sm text-red-300">{error}</p>}

        <label className="block text-sm">
          <span className="text-zinc-400">Nazwa</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Np. Kebabkiller — Sezon 1"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-400">Opis (krótki)</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O czym jest ten serial — dla Ciebie i dla AI"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="text-zinc-400">Style Bible</span>
          <p className="mt-0.5 text-xs text-zinc-500">
            Globalny kanon stylu serialu — trafia do kontekstu LLM (ton, wizualia, zasady świata).
          </p>
          <textarea
            rows={14}
            value={styleBible}
            onChange={(e) => setStyleBible(e.target.value)}
            placeholder="Opisz styl serialu: humor, estetyka, zakazy, spójność postaci…"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? 'Zapisuję…' : isNew ? 'Utwórz projekt' : 'Zapisz zmiany'}
          </button>
          {isNew && onCancelNew && (
            <button
              type="button"
              onClick={onCancelNew}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              Anuluj
            </button>
          )}
          {!isNew && project?.id && (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950"
            >
              Usuń projekt
            </button>
          )}
        </div>
      </form>

      {!isNew && project?.id && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
          <h3 className="font-semibold text-sm">Pamięć serialowa</h3>
          <p className="text-xs text-zinc-500">
            Aktualizowana automatycznie po „Zatwierdź Kanon” na Dashboardzie. Podgląd poniżej.
          </p>
          <SeriesMemoryPanel projectId={project.id} projectName={project.name} />

          {!memoryEditOpen ? (
            <button
              type="button"
              onClick={() => setMemoryEditOpen(true)}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
            >
              Edytuj ręcznie (admin)
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-amber-300">
                Ręczna edycja nadpisuje pamięć — kolejny kanon może ją skompresować ponownie.
              </p>
              <textarea
                rows={8}
                value={seriesMemory}
                onChange={(e) => setSeriesMemory(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono"
              />
              {memoryMessage && (
                <p className="text-xs text-emerald-400">{memoryMessage}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={memorySaving}
                  onClick={handleSaveMemory}
                  className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {memorySaving ? 'Zapisuję…' : 'Zapisz pamięć'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMemoryEditOpen(false);
                    setSeriesMemory(project.series_memory || '');
                    setMemoryMessage('');
                  }}
                  className="rounded-lg border border-zinc-600 px-3 py-1 text-xs hover:bg-zinc-800"
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
