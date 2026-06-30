import { Link } from 'react-router-dom';
import { darkroomPath } from '../../lib/deskRoutes.js';

export default function DarkroomDeskEntry({ projectId, episodePlanId, episodeLabel }) {
  if (!projectId || !episodePlanId) return null;

  return (
    <section className="mb-6 border-2 border-zinc-800 bg-black">
      <div className="border-b border-zinc-800 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-600">
          Kinowa Ciemnia
        </p>
        {episodeLabel && (
          <p className="mt-1 text-sm text-zinc-500">{episodeLabel}</p>
        )}
      </div>
      <div className="p-4">
        <Link
          to={darkroomPath(projectId, episodePlanId)}
          className="block w-full border-2 border-zinc-700 bg-zinc-950 px-6 py-5 text-center text-lg font-black uppercase tracking-wider text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
        >
          Wejdź do Ciemni (Upload)
        </Link>
      </div>
    </section>
  );
}
