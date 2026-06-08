import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import JobStatus from '../components/JobStatus.jsx';

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [knowledge, setKnowledge] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const [jobsData, knowledgeData] = await Promise.all([
        api.jobs.list(),
        api.knowledge(),
      ]);
      setJobs(jobsData);
      setKnowledge(knowledgeData);
    } catch (err) {
      setError(err.message);
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
          Panel produkcji Kebabkiller Studio — status systemu i ostatnie zlecenia.
        </p>
      </header>

      {error && <p className="rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Postacie" value={knowledge?.characters?.length ?? '—'} />
        <StatCard label="Tła" value={knowledge?.backgrounds?.length ?? '—'} />
        <StatCard label="Reguły aktywne" value={knowledge?.rules?.length ?? '—'} />
        <StatCard label="Zlecenia w toku" value={inProgress} />
      </div>

      <div className="flex gap-3">
        <Link
          to="/studio"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
        >
          Nowa scena
        </Link>
        <Link
          to="/settings"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
        >
          Baza wiedzy
        </Link>
      </div>

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
