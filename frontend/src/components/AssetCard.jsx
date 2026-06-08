export default function AssetCard({ title, subtitle, imageUrl, badge, onEdit, onDelete }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex gap-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-20 w-20 rounded-lg object-cover border border-zinc-700"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-950 text-xs text-zinc-500">
            brak
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-zinc-100">{title}</h3>
            {badge && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 line-clamp-3 text-sm text-zinc-400">{subtitle}</p>
          )}
          {(onEdit || onDelete) && (
            <div className="mt-3 flex gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded-lg border border-zinc-600 px-3 py-1 text-xs hover:bg-zinc-800"
                >
                  Edytuj
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-lg border border-red-800 px-3 py-1 text-xs text-red-300 hover:bg-red-950"
                >
                  Usuń
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
