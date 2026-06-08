import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import AssetCard from '../components/AssetCard.jsx';
import RuleEditor from '../components/RuleEditor.jsx';

export default function Settings() {
  const [tab, setTab] = useState('rules');
  const [characters, setCharacters] = useState([]);
  const [backgrounds, setBackgrounds] = useState([]);
  const [rules, setRules] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState(null);
  const [editingBackgroundId, setEditingBackgroundId] = useState(null);

  const characterFormRef = useRef(null);
  const backgroundFormRef = useRef(null);

  async function loadAll() {
    const [chars, bgs, rls] = await Promise.all([
      api.characters.list(),
      api.backgrounds.list(),
      api.rules.list(),
    ]);
    setCharacters(chars);
    setBackgrounds(bgs);
    setRules(rls);
  }

  useEffect(() => {
    loadAll().catch((err) => setError(err.message));
  }, []);

  function resetCharacterForm() {
    characterFormRef.current?.reset();
    setEditingCharacterId(null);
  }

  function resetBackgroundForm() {
    backgroundFormRef.current?.reset();
    setEditingBackgroundId(null);
  }

  function startEditCharacter(character) {
    setTab('characters');
    setEditingCharacterId(character.id);
    setError('');
    setMessage('');
    const form = characterFormRef.current;
    if (!form) return;
    form.name.value = character.name;
    form.description.value = character.description;
    form.identity_block_en.value = character.identity_block_en || '';
    form.negative_prompt.value = character.negative_prompt || '';
    form.reference.value = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function startEditBackground(background) {
    setTab('backgrounds');
    setEditingBackgroundId(background.id);
    setError('');
    setMessage('');
    const form = backgroundFormRef.current;
    if (!form) return;
    form.name.value = background.name;
    form.description.value = background.description;
    form.environment_block_en.value = background.environment_block_en || '';
    form.reference.value = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveCharacter(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const fd = new FormData(e.target);
      if (editingCharacterId) {
        await api.characters.update(editingCharacterId, fd);
        setMessage('Postać zaktualizowana.');
      } else {
        await api.characters.create(fd);
        setMessage('Postać dodana.');
      }
      resetCharacterForm();
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveBackground(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const fd = new FormData(e.target);
      if (editingBackgroundId) {
        await api.backgrounds.update(editingBackgroundId, fd);
        setMessage('Tło zaktualizowane.');
      } else {
        await api.backgrounds.create(fd);
        setMessage('Tło dodane.');
      }
      resetBackgroundForm();
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeCharacter(id) {
    if (!window.confirm('Usunąć tę postać?')) return;
    setError('');
    try {
      await api.characters.delete(id);
      if (editingCharacterId === id) resetCharacterForm();
      setMessage('Postać usunięta.');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeBackground(id) {
    if (!window.confirm('Usunąć to tło?')) return;
    setError('');
    try {
      await api.backgrounds.delete(id);
      if (editingBackgroundId === id) resetBackgroundForm();
      setMessage('Tło usunięte.');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addRule(form) {
    await api.rules.create(form);
    setMessage('Reguła dodana.');
    await loadAll();
  }

  async function updateRule(id, form) {
    await api.rules.update(id, form);
    setMessage('Reguła zaktualizowana.');
    await loadAll();
  }

  async function deleteRule(id) {
    await api.rules.delete(id);
    setMessage('Reguła usunięta.');
    await loadAll();
  }

  const tabs = [
    { id: 'rules', label: 'Księga Praw' },
    { id: 'characters', label: 'Postacie' },
    { id: 'backgrounds', label: 'Tła' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Baza Wiedzy</h1>
        <p className="mt-2 text-zinc-400">
          Tutaj uczysz AI Reżysera — dodawaj postacie, tła i reguły produkcji.
        </p>
      </header>

      {error && <p className="rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}
      {message && <p className="rounded-lg bg-emerald-950 p-3 text-emerald-300">{message}</p>}

      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setMessage(''); setError(''); }}
            className={`rounded-lg px-4 py-2 text-sm ${
              tab === t.id ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rules' && (
        <div className="space-y-6">
          <RuleEditor onSave={addRule} />
          <div className="space-y-3">
            {rules.map((rule) => (
              <RuleEditor
                key={rule.id}
                rule={{ ...rule, active: Boolean(rule.active) }}
                onSave={(form) => updateRule(rule.id, form)}
                onDelete={() => deleteRule(rule.id)}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'characters' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form ref={characterFormRef} onSubmit={saveCharacter} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="font-semibold">
              {editingCharacterId ? 'Edytuj postać' : 'Dodaj postać'}
            </h2>
            {editingCharacterId && (
              <p className="text-xs text-amber-300">
                Tryb edycji — zmiany nadpiszą istniejącą kartę (np. Kebabkiller z seeda).
              </p>
            )}
            <input name="name" required placeholder="Nazwa" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
            <textarea name="description" required placeholder="Opis dla AI Reżysera" rows={3} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
            <textarea name="identity_block_en" required placeholder="Kanon EN (identity_block_en)" rows={2} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono" />
            <textarea name="negative_prompt" placeholder="Negative prompt (opcjonalnie)" rows={2} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
            <p className="text-xs text-zinc-500">
              Ref JPG: jedno ujęcie postaci (najlepiej w scenie). Unikaj model sheetu / trzech widoków na białym tle — trafia na klatkę startową wideo.
            </p>
            <input name="reference" type="file" accept="image/*" className="text-sm" />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              >
                {saving ? 'Zapisuję…' : editingCharacterId ? 'Zapisz zmiany' : 'Dodaj'}
              </button>
              {editingCharacterId && (
                <button
                  type="button"
                  onClick={resetCharacterForm}
                  className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800"
                >
                  Anuluj
                </button>
              )}
            </div>
          </form>
          <div className="space-y-3">
            {characters.map((c) => (
              <AssetCard
                key={c.id}
                title={c.name}
                subtitle={c.description}
                imageUrl={c.reference_path}
                badge="Postać"
                onEdit={() => startEditCharacter(c)}
                onDelete={() => removeCharacter(c.id)}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'backgrounds' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form ref={backgroundFormRef} onSubmit={saveBackground} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="font-semibold">
              {editingBackgroundId ? 'Edytuj tło' : 'Dodaj tło'}
            </h2>
            <input name="name" required placeholder="Nazwa" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
            <textarea name="description" required placeholder="Opis lokacji (PL, dla Ciebie)" rows={3} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" />
            <textarea name="environment_block_en" placeholder="Kanon EN lokacji (environment_block_en) — trafia 1:1 do promptu" rows={2} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono" />
            <p className="text-xs text-zinc-500">
              Ref JPG tła: piec, blat, lokacja 9:16. Przy renderze składamy postać <strong>na</strong> tym obrazku (klatka startowa).
            </p>
            <input name="reference" type="file" accept="image/*" className="text-sm" />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              >
                {saving ? 'Zapisuję…' : editingBackgroundId ? 'Zapisz zmiany' : 'Dodaj'}
              </button>
              {editingBackgroundId && (
                <button
                  type="button"
                  onClick={resetBackgroundForm}
                  className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800"
                >
                  Anuluj
                </button>
              )}
            </div>
          </form>
          <div className="space-y-3">
            {backgrounds.map((b) => (
              <AssetCard
                key={b.id}
                title={b.name}
                subtitle={b.description}
                imageUrl={b.reference_path}
                badge="Tło"
                onEdit={() => startEditBackground(b)}
                onDelete={() => removeBackground(b.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
