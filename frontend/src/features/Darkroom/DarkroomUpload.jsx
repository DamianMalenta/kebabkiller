import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { darkroomPath } from '../../lib/deskRoutes.js';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export default function DarkroomUpload({ projectId, episodePlanId }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [plan, setPlan] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [directorHint, setDirectorHint] = useState('');

  useEffect(() => {
    if (!episodePlanId) return;
    api.episodePlans.get(episodePlanId)
      .then(async (loaded) => {
        const anchor = loaded?.scenes?.find((s) => s.sort_order === 0);
        if (anchor && anchor.start_frame_source !== 'darkroom') {
          const updated = await api.episodePlans.setStartFrameSource(
            episodePlanId,
            anchor.id,
            'darkroom',
          );
          setPlan(updated.plan ?? updated);
        } else {
          setPlan(loaded);
        }
      })
      .catch((err) => setError(err.message));
  }, [episodePlanId]);

  const darkroomSceneOrders = useMemo(() => {
    if (!plan?.scenes?.length) return new Set([0]);
    const orders = plan.scenes
      .filter((s) => s.sort_order === 0 || s.start_frame_source !== 'previous_scene')
      .map((s) => s.sort_order);
    return new Set(orders.length ? orders : [0]);
  }, [plan]);

  const uploadBlocked = plan?.scenes?.length > 1
    && plan.scenes.filter((s) => s.sort_order > 0).every((s) => s.start_frame_source === 'previous_scene');

  const processFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      setError('Wybierz co najmniej jeden plik graficzny.');
      return;
    }
    if (uploadBlocked) {
      setError('Wszystkie sceny 2+ mają ciągłość — brak scen do wgrywania zdjęć.');
      return;
    }

    setBusy(true);
    setError('');
    setStatus(`Wgrywam ${files.length} plik(ów)…`);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append('images', file);
      }

      const uploadResult = await api.darkroom.uploadBatch(episodePlanId, formData);
      const hint = directorHint.trim();

      setStatus('Audyt AI…');
      await api.darkroom.runAudit(episodePlanId, {
        ...(hint
          ? {
              assets: (uploadResult.scene_assets || []).map((asset) => ({
                id: asset.id,
                director_hint: hint,
              })),
            }
          : {}),
      });

      navigate(darkroomPath(projectId, episodePlanId, 'staging'), { replace: true });
    } catch (err) {
      setError(err.message);
      setStatus('');
    } finally {
      setBusy(false);
    }
  }, [directorHint, episodePlanId, projectId, navigate, uploadBlocked]);

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (busy || uploadBlocked) return;
    processFiles(e.dataTransfer.files);
  }

  function onFileChange(e) {
    processFiles(e.target.files);
    e.target.value = '';
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <p className="text-sm text-zinc-500">
        Wgraj jedno zdjęcie na scenę z źródłem „Darkroom”.
        {' '}
        <Link
          to={darkroomPath(projectId, episodePlanId, 'scenes')}
          className="text-amber-500/90 hover:text-amber-400"
        >
          Ustaw sceny i ciągłość →
        </Link>
      </p>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !busy && !uploadBlocked && inputRef.current?.click()}
        onClick={() => !busy && !uploadBlocked && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!uploadBlocked) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-[360px] cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-14 text-center transition-colors ${
          uploadBlocked
            ? 'cursor-not-allowed border-zinc-800 bg-zinc-950/40 opacity-50'
            : dragging
              ? 'border-emerald-500 bg-emerald-950/30'
              : 'border-zinc-700 bg-zinc-900/80 hover:border-zinc-500'
        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        {uploadBlocked ? (
          <>
            <p className="text-lg font-bold uppercase text-zinc-500">Wgrywanie zablokowane</p>
            <p className="mt-3 text-sm text-zinc-600">
              Wszystkie sceny od 2 w górę używają ciągłości — nie ma slotów na nowe zdjęcia.
            </p>
          </>
        ) : (
          <>
            <p className="text-4xl font-black uppercase text-zinc-300">Upuść pliki</p>
            <p className="mt-3 text-zinc-500">lub kliknij, aby wybrać z dysku</p>
            <p className="mt-6 text-xs uppercase tracking-widest text-zinc-600">JPEG · PNG · WEBP · HEIC</p>
            {plan?.scenes?.length > 1 && (
              <p className="mt-4 max-w-md text-xs text-zinc-600">
                Zdjęcia trafiają kolejno do scen z źródłem „Darkroom"
                {darkroomSceneOrders.size > 0 && ` (sceny: ${[...darkroomSceneOrders].map((o) => o + 1).join(', ')})`}.
              </p>
            )}
          </>
        )}
      </div>

      <label className="block border border-zinc-800 bg-zinc-950/60 px-4 py-4">
        <span className="mb-2 block text-xs uppercase tracking-widest text-zinc-500">
          Wskazówka reżyserska
          <span className="ml-2 font-normal normal-case tracking-normal text-zinc-600">(opcjonalnie)</span>
        </span>
        <textarea
          value={directorHint}
          onChange={(e) => setDirectorHint(e.target.value)}
          rows={3}
          disabled={busy}
          placeholder="np. kamera powoli odjeżdża, w tle płonie ogień…"
          className="w-full resize-y border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition-colors focus:border-zinc-600 disabled:opacity-50"
        />
        <p className="mt-2 text-xs text-zinc-600">
          Po polsku — AI przetłumaczy to na techniczny prompt ruchu dla Wan 2.1.
        </p>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={onFileChange}
        disabled={busy || uploadBlocked}
      />

      {status && <p className="text-center text-sm text-amber-400">{status}</p>}
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
