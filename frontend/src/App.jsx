import { NavLink, Route, Routes, useNavigate, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './api/client.js';
import Settings from './pages/Settings.jsx';
import Catalog from './pages/Catalog.jsx';
import Projects from './pages/Projects.jsx';
import DirectorsDesk from './pages/DirectorsDesk.jsx';
import { MobileQuickNav } from './components/MobileNightWelcome.jsx';

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm transition ${
    isActive ? 'bg-amber-500 text-zinc-950 font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
  }`;

function DirectorsDeskRedirect() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    api.projects.list()
      .then((projects) => {
        if (projects[0]) navigate(`/desk/${projects[0].id}`, { replace: true });
        else navigate('/projects', { replace: true });
      })
      .catch((err) => setError(err.message));
  }, [navigate]);

  if (error) return <p className="text-red-400">{error}</p>;
  return <p className="text-zinc-400">Otwieram Stół Reżyserski…</p>;
}

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight text-amber-400 md:text-lg">Kebabkiller Studio V2</p>
            <p className="hidden text-xs text-zinc-500 sm:block">Director's Desk · Katalog</p>
          </div>
          <div className="hidden flex-wrap gap-2 md:flex">
            <NavLink to="/catalog" className={navClass}>Katalog</NavLink>
            <NavLink to="/projects" className={navClass}>Seriale</NavLink>
            <NavLink to="/desk" className={navClass}>Reżyseria</NavLink>
            <NavLink to="/settings" className={navClass}>Baza Wiedzy</NavLink>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 md:py-8 md:pb-8">
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/desk/:projectId" element={<DirectorsDesk />} />
          <Route path="/desk" element={<DirectorsDeskRedirect />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <MobileQuickNav />
    </div>
  );
}
