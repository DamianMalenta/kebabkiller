import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Studio from './pages/Studio.jsx';
import Settings from './pages/Settings.jsx';
import Catalog from './pages/Catalog.jsx';
import EpisodePlan from './pages/EpisodePlan.jsx';

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm transition ${
    isActive ? 'bg-amber-500 text-zinc-950 font-semibold' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
  }`;

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-lg font-bold tracking-tight text-amber-400">Kebabkiller Studio</p>
            <p className="text-xs text-zinc-500">Plan odcinka · Katalog · Produkcja 9:16</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NavLink to="/" end className={navClass}>Dashboard</NavLink>
            <NavLink to="/catalog" className={navClass}>Katalog</NavLink>
            <NavLink to="/studio" className={navClass}>Studio</NavLink>
            <NavLink to="/settings" className={navClass}>Baza Wiedzy</NavLink>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/episodes/:id" element={<EpisodePlan />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
