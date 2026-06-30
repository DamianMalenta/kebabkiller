import { useState } from 'react';
import { api } from '../../api/client.js';

export function SceneCard({ scene }) {
  const layers = scene.layers || scene.collage_hint?.map((path, i) => ({ path, label: `Warstwa ${i + 1}` })) || [];
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-400">
          Scena {typeof scene.scene_index === 'number' ? scene.scene_index + 1 : '—'}
        </p>
        <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {scene.duration_sec ?? 4}s
        </span>
      </div>
      <p className="mb-3 text-sm text-zinc-200">{scene.description_pl}</p>
      <div className="flex gap-2 overflow-x-auto">
        {layers.length === 0 && (
          <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500">
            Brak podglądu — dodaj assety
          </div>
        )}
        {layers.map((layer) => (
          <div key={layer.image_id || layer.path} className="min-w-[88px]">
            {layer.path ? (
              <img src={layer.path} alt={layer.label} className="h-24 w-24 rounded-lg object-cover" />
            ) : null}
            <p className="mt-1 truncate text-[10px] text-zinc-500">{layer.label}</p>
          </div>
        ))}
      </div>
      {scene.camera && (
        <p className="mt-2 text-xs text-zinc-500">Kamera: {scene.camera}</p>
      )}
    </div>
  );
}

export function WorkflowPreview({ rules, render_params: renderParams }) {
  return (
    <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm">
      <p className="mb-2 font-semibold text-emerald-400">Podgląd workflow GPU</p>
      <ul className="space-y-1 text-zinc-300">
        <li>Profil: {rules?.i2v_profile}</li>
        <li>Klatki: {renderParams?.length}</li>
        <li>Denoise: {rules?.denoise}</li>
        <li>Ciągłość: {rules?.continuity_mode}</li>
      </ul>
    </div>
  );
}

export function ConfirmationCard({ summary, message, action, onConfirm, onReject }) {
  const displayMessage = summary || message;
  return (
    <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
      <p className="mb-3 text-sm text-amber-100">{displayMessage}</p>
      {action && action.type === 'redirect' ? (
        <a href={action.url} className="inline-block rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 text-decoration-none">
          Otwórz
        </a>
      ) : (
        <div className="flex gap-2">
          <button type="button" onClick={onConfirm} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950">
            Tak, akceptuję
          </button>
          <button type="button" onClick={onReject} className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300">
            Nie
          </button>
        </div>
      )}
    </div>
  );
}

export function SideThreadBubble({ thread_id: threadId, preview, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(threadId)}
      className="block w-full rounded-xl border border-sky-800/50 bg-sky-950/30 p-3 text-left text-sm text-sky-100"
    >
      <span className="font-semibold">Wątek poboczny</span>
      <p className="mt-1 text-xs text-sky-200/80">{preview}</p>
    </button>
  );
}

export function AssetUploadRequest({ hint, asset_type: assetType }) {
  return (
    <div className="rounded-xl border border-violet-800/40 bg-violet-950/20 p-4 text-sm text-violet-100">
      <p className="font-semibold">Potrzebny upload ({assetType || 'asset'})</p>
      <p className="mt-1 text-violet-200/80">{hint}</p>
      <p className="mt-2 text-xs text-zinc-500">Użyj Katalogu lub przeciągnij plik w lewym panelu.</p>
    </div>
  );
}

export function ProductionTrigger({ episode_plan_id: episodePlanId, message, onProductionStarted }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function handleProduce() {
    setStatus('loading');
    setError('');
    try {
      await api.episodePlans.produce(episodePlanId);
      setStatus('success');
      onProductionStarted?.();
    } catch (err) {
      setError(err.message || 'Błąd uruchamiania produkcji');
      setStatus('error');
    }
  }

  return (
    <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/20 p-4 mt-2">
      <p className="mb-3 text-sm text-emerald-100">{message}</p>
      {status === 'idle' && (
        <button type="button" onClick={handleProduce} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400">
          Uruchom produkcję (RunComfy)
        </button>
      )}
      {status === 'loading' && <p className="text-xs text-zinc-400">Wysyłanie do RunComfy…</p>}
      {status === 'success' && <p className="text-xs text-emerald-400 font-bold">Zlecenie wysłane — status w panelu Produkcja poniżej.</p>}
      {status === 'error' && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

const WIDGET_MAP = {
  SceneCard,
  WorkflowPreview,
  ConfirmationCard,
  SideThread: SideThreadBubble,
  AssetUploadRequest,
  ProductionTrigger,
};

export function renderChatWidget(widget, handlers = {}) {
  const Component = WIDGET_MAP[widget.type];
  if (!Component) return null;
  return <Component key={JSON.stringify(widget.props)} {...widget.props} {...handlers} />;
}
