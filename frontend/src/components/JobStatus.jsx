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

export default function JobStatus({ job, onRefresh }) {
  const label = STATUS_LABELS[job.status] || job.status;
  const color = STATUS_COLORS[job.status] || STATUS_COLORS.pending;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${color}`}>
            {label}
          </span>
          <p className="mt-2 font-medium text-zinc-100">{job.user_prompt}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {job.character_name && `Postać: ${job.character_name}`}
            {job.background_name && ` · Tło: ${job.background_name}`}
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          {new Date(job.created_at).toLocaleString('pl-PL')}
        </div>
      </div>

      {job.status !== 'completed' && job.status !== 'failed' && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${job.progress || 0}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">{job.progress || 0}%</p>
          {job.status_message && (
            <p className="mt-1 text-xs text-amber-300/90">{job.status_message}</p>
          )}
        </div>
      )}

      {job.director_json && (
        <div className="mt-4 rounded-lg bg-zinc-950 p-3 text-xs">
          <p className="font-semibold text-zinc-400 mb-2">Storyboard podglądowy:</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {job.director_json.character_ref ? (
               <div>
                  <p className="text-zinc-500 mb-1">Postać:</p>
                  <img src={job.director_json.character_ref} alt="Postać referencyjna" className="rounded border border-zinc-800 w-full h-auto object-cover max-h-32" />
               </div>
            ) : <div className="text-zinc-600 italic">Brak postaci ref.</div>}
            {job.director_json.background_ref ? (
               <div>
                  <p className="text-zinc-500 mb-1">Tło:</p>
                  <img src={job.director_json.background_ref} alt="Tło referencyjne" className="rounded border border-zinc-800 w-full h-auto object-cover max-h-32" />
               </div>
            ) : <div className="text-zinc-600 italic">Brak tła ref.</div>}
          </div>
          <div className="space-y-1">
             <p><span className="text-zinc-500">Positive:</span> {job.director_json.positive_prompt}</p>
          </div>
        </div>
      )}

      {job.status === 'completed' && job.output_path && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-2">
          {outputMediaKind(job.output_path) === 'video' ? (
            <video
              controls
              className="mx-auto max-h-80 w-full rounded"
              src={`/api/jobs/${job.id}/download`}
            />
          ) : outputMediaKind(job.output_path) === 'image' ? (
            <img
              alt="Podgląd animacji"
              className="mx-auto max-h-80 w-full rounded object-contain"
              src={`/api/jobs/${job.id}/download`}
            />
          ) : (
            <p className="text-xs text-zinc-500">Podgląd niedostępny dla tego formatu.</p>
          )}
        </div>
      )}

      {job.error_message && (
        <p className="mt-2 text-sm text-red-400">{job.error_message}</p>
      )}

      <div className="mt-3 flex gap-2">
        {onRefresh && (
          <button
            onClick={() => onRefresh(job.id)}
            className="rounded-lg border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
          >
            Odśwież
          </button>
        )}
        {job.status === 'completed' && (
          <a
            href={`/api/jobs/${job.id}/download`}
            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Pobierz
          </a>
        )}
      </div>
    </div>
  );
}
