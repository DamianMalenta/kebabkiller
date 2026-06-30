import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { darkroomPath, deskPath, rememberDeskContext } from '../../lib/deskRoutes.js';
import DarkroomUpload from './DarkroomUpload.jsx';
import DarkroomStaging from './DarkroomStaging.jsx';
import DarkroomSceneManager from './DarkroomSceneManager.jsx';

function DarkroomHeader({ projectId, episodePlanId, plan }) {
  const label = plan ? `${plan.code}${plan.title ? ` — ${plan.title}` : ''}` : episodePlanId.slice(0, 8);

  return (
    <div className="mb-6 space-y-3">
      <Link
        to={deskPath(projectId, episodePlanId)}
        className="inline-block text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Wróć do Studia
      </Link>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">Kinowa Ciemnia</p>
          <h1 className="text-lg font-bold text-zinc-200">{label}</h1>
          <p className="font-mono text-xs text-zinc-600">episode_plan_id: {episodePlanId}</p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link
            to={darkroomPath(projectId, episodePlanId, 'scenes')}
            className="text-zinc-500 hover:text-zinc-300"
          >
            Sceny
          </Link>
          <span className="text-zinc-700">/</span>
          <Link
            to={darkroomPath(projectId, episodePlanId, 'upload')}
            className="text-zinc-500 hover:text-zinc-300"
          >
            Wlot
          </Link>
          <span className="text-zinc-700">/</span>
          <Link
            to={darkroomPath(projectId, episodePlanId, 'staging')}
            className="text-zinc-500 hover:text-zinc-300"
          >
            Poczekalnia
          </Link>
        </nav>
      </div>
    </div>
  );
}

export default function DarkroomModule() {
  const { projectId, episodePlanId } = useParams();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projectId && episodePlanId) {
      rememberDeskContext(projectId, episodePlanId);
    }
  }, [projectId, episodePlanId]);

  useEffect(() => {
    if (!episodePlanId) return;
    api.episodePlans.get(episodePlanId)
      .then(setPlan)
      .catch((err) => setError(err.message));
  }, [episodePlanId]);

  if (!projectId || !episodePlanId) {
    return <p className="text-red-400">Brak projectId lub episodePlanId w URL.</p>;
  }

  return (
    <div className="min-h-[70vh] bg-zinc-950">
      <DarkroomHeader
        projectId={projectId}
        episodePlanId={episodePlanId}
        plan={plan}
      />
      {error && (
        <p className="mb-4 rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <Routes>
        <Route index element={<Navigate to="scenes" replace />} />
        <Route
          path="scenes"
          element={<DarkroomSceneManager projectId={projectId} episodePlanId={episodePlanId} />}
        />
        <Route
          path="upload"
          element={<DarkroomUpload projectId={projectId} episodePlanId={episodePlanId} />}
        />
        <Route
          path="staging"
          element={<DarkroomStaging episodePlanId={episodePlanId} projectId={projectId} />}
        />
      </Routes>
    </div>
  );
}
