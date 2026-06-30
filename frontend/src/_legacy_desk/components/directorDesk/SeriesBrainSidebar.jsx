import { Link } from 'react-router-dom';

export default function SeriesBrainSidebar({ brain, collapsed, onToggle, onRemoveTag }) {
  if (!brain) {
    return (
      <aside className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
        Ładowanie Mózgu Serialu…
      </aside>
    );
  }

  const { project, canon_gallery: gallery, episode, storyboard } = brain;

  return (
    <aside className={`director-sidebar rounded-2xl border border-zinc-800 bg-zinc-950 ${collapsed ? 'collapsed' : ''}`}>
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Mózg Serialu</p>
          <p className="font-semibold text-amber-400">{project.name}</p>
        </div>
        <button type="button" onClick={onToggle} className="text-xs text-zinc-500 hover:text-zinc-300">
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-4 p-4 text-sm">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Kanon</h3>
            <p className="text-zinc-300">{project.canon?.style_text || project.description || '—'}</p>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Tagi generatora</h3>
            <div className="flex flex-wrap gap-2">
              {(project.generator_tags || []).map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-xs text-amber-200">
                  {tag}
                  {onRemoveTag && (
                    <button type="button" onClick={() => onRemoveTag(tag)} className="text-zinc-500 hover:text-red-400">×</button>
                  )}
                </span>
              ))}
              {(!project.generator_tags || project.generator_tags.length === 0) && (
                <span className="text-xs text-zinc-600">Brak tagów — negocjuj w czacie</span>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Galeria Kanonu</h3>
            <div className="grid grid-cols-2 gap-2">
              {(gallery || []).map((asset) => (
                <div key={asset.id} className="rounded-lg border border-zinc-800 p-2">
                  {asset.primary_image?.path ? (
                    <img src={asset.primary_image.path} alt={asset.name} className="mb-1 h-16 w-full rounded object-cover" />
                  ) : (
                    <div className="mb-1 flex h-16 items-center justify-center rounded bg-zinc-900 text-[10px] text-zinc-600">brak JPG</div>
                  )}
                  <p className="truncate text-xs text-zinc-400">{asset.name}</p>
                </div>
              ))}
            </div>
          </section>

          {episode && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Bieżący odcinek</h3>
              <p className="text-zinc-300">{episode.code} — {episode.title || episode.logline || 'Szkic'}</p>
              <p className="mt-1 text-xs text-zinc-500">{episode.scenes?.length ?? 0} scen</p>
            </section>
          )}

          {storyboard && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Storyboard</h3>
              <p className="text-xs text-zinc-400">
                {storyboard.ready_count}/{storyboard.total} scen z podglądem
              </p>
            </section>
          )}

          <Link
            to="/catalog"
            className="block rounded-lg border border-zinc-700 px-3 py-2 text-center text-xs text-amber-300 hover:bg-zinc-900"
          >
            + Dodaj asset w Katalogu
          </Link>
        </div>
      )}
    </aside>
  );
}
