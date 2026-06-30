import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { darkroomPath } from '../../lib/deskRoutes.js';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export default function DarkroomUpload({ projectId, episodePlanId }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const processFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) {
      setError('Wybierz co najmniej jeden plik graficzny.');
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

      await api.darkroom.uploadBatch(episodePlanId, formData);
      setStatus('Audyt AI…');
      await api.darkroom.runAudit(episodePlanId);
      navigate(darkroomPath(projectId, episodePlanId, 'staging'), { replace: true });
    } catch (err) {
      setError(err.message);
      setStatus('');
    } finally {
      setBusy(false);
    }
  }, [episodePlanId, projectId, navigate]);

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    processFiles(e.dataTransfer.files);
  }

  function onFileChange(e) {
    processFiles(e.target.files);
    e.target.value = '';
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !busy && inputRef.current?.click()}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-[420px] cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-16 text-center transition-colors ${
          dragging
            ? 'border-emerald-500 bg-emerald-950/30'
            : 'border-zinc-700 bg-zinc-900/80 hover:border-zinc-500'
        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <p className="text-4xl font-black uppercase text-zinc-300">Upuść pliki</p>
        <p className="mt-3 text-zinc-500">lub kliknij, aby wybrać z dysku</p>
        <p className="mt-6 text-xs uppercase tracking-widest text-zinc-600">JPEG · PNG · WEBP · HEIC</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={onFileChange}
        disabled={busy}
      />

      {status && <p className="mt-4 text-center text-sm text-amber-400">{status}</p>}
      {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
