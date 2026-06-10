import { useState } from 'react';
import { api } from '../api/client.js';

export default function SeriesMemoryPanel({ projectId, projectName, compact = false }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [memory, setMemory] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');

  async function loadMemory() {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const ctx = await api.director.projectContext(projectId);
      setMemory(ctx.project?.series_memory || '');
      setUpdatedAt(ctx.project?.series_memory_updated_at || '');
      setOpen(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    loadMemory();
  }

  if (!projectId) return null;

  const label = projectName ? `Pamięć: ${projectName}` : 'Pamięć serialowa';

  return (
    <div className={compact ? '' : 'mt-2'}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        title={label}
        className={`inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 ${compact ? '' : 'mt-1'}`}
      >
        {loading ? (
          <Spinner className="h-3 w-3" />
        ) : (
          <InfoIcon className="h-3.5 w-3.5 text-zinc-400" />
        )}
        {!compact && <span>Pamięć serialowa</span>}
      </button>

      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}

      {open && !loading && (
        <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-zinc-300">{label}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-zinc-500 hover:text-zinc-300"
              aria-label="Zamknij"
            >
              ×
            </button>
          </div>
          {updatedAt && (
            <p className="mt-1 text-zinc-500">
              Aktualizacja: {new Date(updatedAt).toLocaleString('pl-PL')}
            </p>
          )}
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-zinc-300">
            {memory || '(pusta — pierwsza scena kanonu jeszcze nie została zatwierdzona)'}
          </pre>
        </div>
      )}
    </div>
  );
}

function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function InfoIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}
