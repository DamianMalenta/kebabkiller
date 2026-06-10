import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ProjectPickModal from './ProjectPickModal.jsx';
import SeriesMemoryPanel from './SeriesMemoryPanel.jsx';
import { isZombieJob, jobAgeMinutes } from '../utils/jobLifecycle.js';

const STATUS_LABELS = {
  pending: 'Oczekuje',
  directing: 'Reżyseria',
  rendering: 'Renderowanie',
  completed: 'Gotowe',
  failed: 'Błąd',
};

const STATUS_COLORS = {
  pending: 'bg-zinc-700 text-zinc-200',
  directing: 'bg-blue-900 text-blue-200',
  rendering: 'bg-amber-900 text-amber-200',
  completed: 'bg-emerald-900 text-emerald-200',
  failed: 'bg-red-900 text-red-200',
};

function outputMediaKind(outputPath) {
  const ext = outputPath?.split('.').pop()?.toLowerCase();
  if (ext === 'webm' || ext === 'mp4') return 'video';
  if (ext === 'webp' || ext === 'gif') return 'image';
  return null;
}

function Spinner({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function JobStatus({ job, projects = [], onJobUpdate, onRefresh }) {
  const [localJob, setLocalJob] = useState(job);
  const [canonLoading, setCanonLoading] = useState(false);
  const [canonError, setCanonError] = useState('');
  const [showProjectPick, setShowProjectPick] = useState(false);
  const [seriesMemoryPreview, setSeriesMemoryPreview] = useState('');

  useEffect(() => {
    if (!canonLoading) {
      setLocalJob(job);
    }
  }, [job, canonLoading]);

  const label = STATUS_LABELS[localJob.status] || localJob.status;
  const color = STATUS_COLORS[localJob.status] || STATUS_COLORS.pending;
  const isCanonComplete = Boolean(localJob.canon_complete);
  const showCanonBadge = localJob.status === 'completed' && Boolean(localJob.is_canon) && isCanonComplete;
  const showCanonButton = localJob.status === 'completed' && !isCanonComplete && !canonLoading;
  const projectName = projects.find((p) => p.id === localJob.project_id)?.name;
  const isZombie = isZombieJob(localJob);
  const ageMin = jobAgeMinutes(localJob);

  async function runCanonAcceptance(projectId) {
    setCanonError('');
    setCanonLoading(true);
    try {
      const result = await api.jobs.setJobAsCanon(localJob.id, projectId);
      const updated = {
        ...localJob,
        ...result,
        is_canon: true,
        project_id: projectId,
        canon_complete: !result.skipped || Boolean(result.series_memory),
        director_json: result.director_json ?? localJob.director_json,
      };
      if (result.series_memory) {
        setSeriesMemoryPreview(result.series_memory);
      }
      setLocalJob(updated);
      onJobUpdate?.(updated);
    } catch (err) {
      setCanonError(err.message);
    } finally {
      setCanonLoading(false);
      setShowProjectPick(false);
    }
  }

  function handleCanonClick() {
    setCanonError('');
    const projectId = localJob.project_id;
    if (projectId) {
      runCanonAcceptance(projectId);
      return;
    }
    if (projects.length === 0) {
      setCanonError('no_projects');
      return;
    }
    setShowProjectPick(true);
  }

  function handleProjectPickConfirm(projectId) {
    setShowProjectPick(false);
    runCanonAcceptance(projectId);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${color}`}>
            {label}
          </span>
          {showCanonBadge && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-violet-900 px-2 py-0.5 text-xs font-medium text-violet-200">
              <span aria-hidden="true">★</span> Kanon
            </span>
          )}
          {isZombie && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-orange-950 px-2 py-0.5 text-xs font-medium text-orange-200 ring-1 ring-orange-800">
              Utknięte
            </span>
          )}
          <p className="mt-2 font-medium text-zinc-100">{localJob.user_prompt}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {localJob.character_name && `Postać: ${localJob.character_name}`}
            {localJob.background_name && ` · Tło: ${localJob.background_name}`}
            {localJob.project_id && projectName && ` · Projekt: ${projectName}`}
          </p>
          {localJob.project_id && (
            <SeriesMemoryPanel
              projectId={localJob.project_id}
              projectName={projectName}
              compact
            />
          )}
        </div>
        <div className="text-right text-xs text-zinc-500">
          {new Date(localJob.created_at).toLocaleString('pl-PL')}
        </div>
      </div>

      {isZombie && (
        <div className="mt-3 rounded-lg border border-orange-900/60 bg-orange-950/30 p-3 text-xs text-orange-200">
          <p className="font-semibold">Zombie job — brak postępu od {ageMin ?? '?'} min</p>
          <p className="mt-1 text-orange-200/80">
            Backend prawdopodobnie stracił kontakt z RunComfy (restart, timeout lub freeze GPU).
            Sprawdź panel RunComfy i anuluj wiszący request, potem uruchom nową scenę w Studio.
          </p>
        </div>
      )}

      {localJob.status !== 'completed' && localJob.status !== 'failed' && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${localJob.progress || 0}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">{localJob.progress || 0}%</p>
          {localJob.status_message && (
            <p className="mt-1 text-xs text-amber-300/90">{localJob.status_message}</p>
          )}
        </div>
      )}

      {localJob.director_json && (
        <div className="mt-4 rounded-lg bg-zinc-950 p-3 text-xs">
          <p className="font-semibold text-zinc-400 mb-2">Storyboard podglądowy:</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {localJob.director_json.character_ref ? (
              <div>
                <p className="text-zinc-500 mb-1">Postać:</p>
                <img src={localJob.director_json.character_ref} alt="Postać referencyjna" className="rounded border border-zinc-800 w-full h-auto object-cover max-h-32" />
              </div>
            ) : <div className="text-zinc-600 italic">Brak postaci ref.</div>}
            {localJob.director_json.background_ref ? (
              <div>
                <p className="text-zinc-500 mb-1">Tło:</p>
                <img src={localJob.director_json.background_ref} alt="Tło referencyjne" className="rounded border border-zinc-800 w-full h-auto object-cover max-h-32" />
              </div>
            ) : <div className="text-zinc-600 italic">Brak tła ref.</div>}
          </div>
          <div className="space-y-1">
            <p><span className="text-zinc-500">Positive:</span> {localJob.director_json.positive_prompt}</p>
          </div>
        </div>
      )}

      {localJob.status === 'completed' && localJob.output_path && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
          {outputMediaKind(localJob.output_path) === 'video' ? (
            <video
              controls
              className="mx-auto max-h-80 w-full rounded"
              src={`/api/jobs/${localJob.id}/download`}
            />
          ) : outputMediaKind(localJob.output_path) === 'image' ? (
            <img
              alt="Podgląd animacji"
              className="mx-auto max-h-80 w-full rounded object-contain"
              src={`/api/jobs/${localJob.id}/download`}
            />
          ) : (
            <p className="text-xs text-zinc-500">Podgląd niedostępny dla tego formatu.</p>
          )}
        </div>
      )}

      {seriesMemoryPreview && (
        <div className="mt-3 rounded-lg border border-violet-900/50 bg-violet-950/20 p-3 text-xs">
          <p className="font-semibold text-violet-200">Pamięć serialowa zaktualizowana</p>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-zinc-300">
            {seriesMemoryPreview}
          </pre>
        </div>
      )}

      {localJob.error_message && (
        <p className="mt-2 text-sm text-red-400">{localJob.error_message}</p>
      )}
      {canonError === 'no_projects' ? (
        <p className="mt-2 text-sm text-red-400">
          Brak projektów —{' '}
          <Link to="/projects" className="underline hover:text-red-300">utwórz serial</Link>
          , aby przypisać kanon.
        </p>
      ) : canonError && (
        <p className="mt-2 text-sm text-red-400">{canonError}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {onRefresh && (
          <button
            onClick={() => onRefresh(localJob.id)}
            className="rounded-lg border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
          >
            Odśwież
          </button>
        )}
        {localJob.status === 'completed' && (
          <a
            href={`/api/jobs/${localJob.id}/download`}
            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Pobierz
          </a>
        )}
        {canonLoading && (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-lg border border-violet-700 bg-violet-950/40 px-3 py-1 text-xs text-violet-200 opacity-90"
          >
            <Spinner />
            Kompresja pamięci…
          </button>
        )}
        {showCanonButton && (
          <button
            type="button"
            onClick={handleCanonClick}
            className="rounded-lg border border-violet-700 px-3 py-1 text-xs font-medium text-violet-200 hover:bg-violet-950"
          >
            {localJob.is_canon ? 'Kontynuuj kompresję' : 'Zatwierdź Kanon'}
          </button>
        )}
      </div>

      {showProjectPick && (
        <ProjectPickModal
          projects={projects}
          onConfirm={handleProjectPickConfirm}
          onCancel={() => setShowProjectPick(false)}
        />
      )}
    </div>
  );
}
