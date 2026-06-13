export default function MobileSceneEditor({
  scenes,
  assets,
  onPatch,
  onRemove,
  onAdd,
  onPersist,
  busy,
  saveLabel,
  saveState,
}) {
  const characters = assets.filter((a) => a.type === 'character' || a.type === 'prop');
  const locations = assets.filter((a) => a.type === 'location');

  return (
    <div className="space-y-3 md:hidden">
      {scenes.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-sm text-zinc-500">
          Brak scen — użyj Scenarzysty (krok 2) lub dodaj ręcznie.
        </p>
      )}

      {scenes.map((scene, index) => (
        <article
          key={scene.id || index}
          className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-amber-400">Scena {index + 1}</span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="rounded-lg px-3 py-2 text-sm text-red-400 active:bg-red-950/40"
            >
              Usuń
            </button>
          </div>

          <label className="block text-sm">
            <span className="text-zinc-400">Opis PL</span>
            <textarea
              value={scene.description_pl || ''}
              onChange={(e) => onPatch(index, { description_pl: e.target.value }, false)}
              onBlur={(e) => onPatch(index, { description_pl: e.target.value }, true)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-base"
            />
          </label>

          <label className="block text-sm">
            <span className="text-zinc-400">Czas (2–10 s)</span>
            <input
              type="number"
              step="0.5"
              min="2"
              max="10"
              value={scene.duration_sec}
              onChange={(e) => onPatch(index, { duration_sec: Number(e.target.value) }, false)}
              onBlur={(e) => onPatch(index, { duration_sec: Number(e.target.value) }, true)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-base"
            />
          </label>

          <label className="block text-sm">
            <span className="text-zinc-400">Postać / rekwizyt</span>
            <select
              value={scene.asset_id || ''}
              onChange={(e) => onPatch(index, { asset_id: e.target.value || null }, true)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-base"
            >
              <option value="">— wybierz —</option>
              {characters.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-zinc-400">Lokacja</span>
            <select
              value={scene.location_asset_id || ''}
              onChange={(e) => onPatch(index, { location_asset_id: e.target.value || null }, true)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-base"
            >
              <option value="">— wybierz —</option>
              {locations.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        </article>
      ))}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl border border-zinc-600 px-4 py-3 text-base font-medium active:bg-zinc-800"
        >
          + Dodaj scenę
        </button>
        <button
          type="button"
          onClick={onPersist}
          disabled={busy}
          className="rounded-xl bg-zinc-800 px-4 py-3 text-base font-medium disabled:opacity-50"
        >
          Zapisz wszystkie sceny
        </button>
      </div>

      {saveLabel && (
        <p className={`text-center text-xs ${saveState === 'error' ? 'text-red-400' : 'text-zinc-500'}`}>
          {saveLabel}
        </p>
      )}
    </div>
  );
}
