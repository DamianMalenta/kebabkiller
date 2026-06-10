import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function ProjectPickModal({
  projects,
  title = 'Do jakiego projektu przypisać ten kanon?',
  onConfirm,
  onCancel,
}) {
  const [selectedId, setSelectedId] = useState(projects[0]?.id ?? '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-pick-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl">
        <h3 id="project-pick-title" className="text-lg font-semibold text-zinc-100">
          {title}
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          Scena zostanie zapisana w pamięci serialowej wybranego projektu.
        </p>

        {projects.length === 0 ? (
          <p className="mt-4 text-sm text-amber-300">
            Brak projektów.{' '}
            <Link to="/projects" className="underline hover:text-amber-200">Utwórz serial</Link>
            {' '}w panelu Seriale.
          </p>
        ) : (
          <label className="mt-4 block text-sm">
            <span className="text-zinc-400">Projekt</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => onConfirm(selectedId)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Zatwierdź
          </button>
        </div>
      </div>
    </div>
  );
}
