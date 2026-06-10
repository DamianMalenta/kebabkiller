import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import JobStatus from '../components/JobStatus.jsx';

const STATUS_LABELS = {
  szkic: 'Szkic',
  brakuje_materialow: 'Brakuje materiałów',
  gotowy_do_akceptacji: 'Gotowy do akceptacji',
  zaakceptowany: 'Zaakceptowany',
  w_produkcji: 'W produkcji',
  gotowy: 'Gotowy',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [knowledge, setKnowledge] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const [jobsData, knowledgeData, episodesData] = await Promise.all([
        api.jobs.list(),
        api.knowledge(),
        api.episodePlans.list(),
      ]);
      setJobs(jobsData);
      setKnowledge(knowledgeData);
      setEpisodes(episodesData);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createEpisode() {
    setCreating(true);
    setError('');
    try {
      const code = `E${String(episodes.length + 1).padStart(2, '0')}`;
      const plan = await api.episodePlans.create({
        code,
        title: `Odcinek ${code}`,
        target_duration_sec: 45,
      });
      navigate(`/episodes/${plan.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, []);

  async function refreshJob(id) {
    const updated = await api.jobs.get(id);
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updated } : j)));
  }

  const completed = jobs.filter((j) => j.status === 'completed').length;
  const inProgress = jobs.filter((j) => !['completed', 'failed'].includes(j.status)).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-zinc-50">Dashboard</h1>
        <p className="mt-2 text-zinc-400">
          Odcinki serialu, katalog i status renderów legacy.
        </p>
      </header>

      {error && <p className="rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Odcinki" value={episodes.length} />
        <StatCard label="Postacie" value={knowledge?.characters?.length ?? '—'} />
        <StatCard label="Tła" value={knowledge?.backgrounds?.length ?? '—'} />
        <StatCard label="Reguły aktywne" value={knowledge?.rules?.length ?? '—'} />
        <StatCard label="Zlecenia w toku" value={inProgress} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={creating}
          onClick={createEpisode}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {creating ? 'Tworzę…' : 'Nowy odcinek (Plan)'}
        </button>
        <Link to="/catalog" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
          Katalog
        </Link>
        <Link to="/studio" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
          Studio (legacy)
        </Link>
        <Link to="/settings" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
          Baza wiedzy
        </Link>
      </div>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Odcinki</h2>
        <div className="space-y-2">
          {episodes.length === 0 && (
            <p className="text-zinc-500">Brak odcinków — utwórz pierwszy plan odcinka.</p>
          )}
          {episodes.map((ep) => (
            <Link
              key={ep.id}
              to={`/episodes/${ep.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:border-amber-700"
            >
              <div>
                <p className="font-semibold text-zinc-100">{ep.code} — {ep.title || 'Bez tytułu'}</p>
                <p className="text-sm text-zinc-500">{ep.scenes?.length ?? 0} scen · cel {ep.target_duration_sec}s</p>
              </div>
              <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-amber-300">
                {STATUS_LABELS[ep.status] || ep.status}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Ostatnie zlecenia ({completed} ukończonych)
        </h2>
        <div className="space-y-3">
          {jobs.length === 0 && (
            <p className="text-zinc-500">Brak zleceń. Utwórz pierwszą scenę w Studio.</p>
          )}
          {jobs.map((job) => (
            <JobStatus key={job.id} job={job} onRefresh={refreshJob} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-amber-400">{value}</p>
    </div>
  );
}
