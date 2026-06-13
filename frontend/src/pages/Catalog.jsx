import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import AssetCard from '../components/AssetCard.jsx';
import StepGuide from '../components/StepGuide.jsx';

const ASSET_TYPES = [
  { value: 'character', label: 'Postać' },
  { value: 'location', label: 'Lokacja' },
  { value: 'prop', label: 'Rekwizyt' },
  { value: 'detail', label: 'Detal' },
];

export default function Catalog() {
  const [assets, setAssets] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const formRef = useRef(null);

  async function load() {
    const data = await api.assets.list(filter || undefined);
    setAssets(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [filter]);

  function resetForm() {
    formRef.current?.reset();
    setEditingId(null);
  }

  function startEdit(asset) {
    setEditingId(asset.id);
    const form = formRef.current;
    if (!form) return;
    form.type.value = asset.type;
    form.name.value = asset.name;
    form.description_pl.value = asset.description_pl || '';
    form.canon_en.value = asset.canon_en || '';
    form.image.value = '';
  }

  async function saveAsset(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const fd = new FormData(e.target);
      if (editingId) {
        await api.assets.update(editingId, fd);
        setMessage('Asset zaktualizowany.');
      } else {
        await api.assets.create(fd);
        setMessage('Asset dodany do katalogu.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAsset(id) {
    if (!window.confirm('Usunąć asset z katalogu?')) return;
    try {
      await api.assets.delete(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-zinc-50">Katalog główny</h1>
        <p className="mt-2 text-zinc-400">
          Biblioteka postaci, lokacji i rekwizytów — plan odcinka wybiera stąd materiały.
        </p>
      </header>

      {error && <p className="rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}
      {message && <p className="rounded-lg bg-emerald-950 p-3 text-emerald-300">{message}</p>}

      <StepGuide step={0} title="Materiały przed planem odcinka" done={assets.some((a) => a.type === 'character' && a.images?.length) && assets.some((a) => a.type === 'location' && a.images?.length)}>
        <p>
          Plan odcinka przypisuje do scen <strong className="text-zinc-300">postacie</strong> i{' '}
          <strong className="text-zinc-300">lokacje</strong> z tego katalogu. Każdy asset potrzebuje co najmniej jednego zdjęcia (JPG/PNG).
          Po dodaniu wróć na <Link to="/" className="text-amber-400 hover:underline">Dashboard</Link> → Nowy odcinek.
        </p>
      </StepGuide>

      <div className="flex flex-wrap gap-2">
        <FilterButton active={!filter} onClick={() => setFilter('')}>Wszystkie</FilterButton>
        {ASSET_TYPES.map((t) => (
          <FilterButton key={t.value} active={filter === t.value} onClick={() => setFilter(t.value)}>
            {t.label}
          </FilterButton>
        ))}
      </div>

      <form ref={formRef} onSubmit={saveAsset} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-100">
          {editingId ? 'Edytuj asset' : 'Dodaj asset'}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-zinc-400">Typ</span>
            <select name="type" defaultValue="prop" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
              {ASSET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Nazwa</span>
            <input name="name" required className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-zinc-400">Opis (PL)</span>
          <textarea name="description_pl" rows={2} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Canon EN (opcjonalnie)</span>
          <textarea name="canon_en" rows={2} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Zdjęcie (JPG/PNG)</span>
          <input name="image" type="file" accept="image/*" className="mt-1 block w-full text-sm text-zinc-400" />
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-amber-500 px-4 py-3.5 text-base font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 md:w-auto md:rounded-lg md:py-2 md:text-sm">
            {saving ? 'Zapisuję…' : (editingId ? 'Zapisz' : 'Dodaj')}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded-lg border border-zinc-600 px-4 py-2 text-sm">
              Anuluj
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {assets.map((asset) => {
          const primary = asset.images?.find((i) => i.is_primary) || asset.images?.[0];
          return (
            <AssetCard
              key={asset.id}
              title={asset.name}
              subtitle={asset.description_pl}
              imageUrl={primary?.path}
              badge={ASSET_TYPES.find((t) => t.value === asset.type)?.label || asset.type}
              onEdit={() => startEdit(asset)}
              onDelete={() => removeAsset(asset.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2.5 text-sm md:py-1.5 ${
        active ? 'bg-amber-500 text-zinc-950 font-semibold' : 'border border-zinc-700 text-zinc-400 hover:bg-zinc-900'
      }`}
    >
      {children}
    </button>
  );
}
