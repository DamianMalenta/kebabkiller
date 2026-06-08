import { useState } from 'react';

export default function RuleEditor({ rule, onSave, onDelete }) {
  const [form, setForm] = useState({
    category: rule?.category || 'global',
    title: rule?.title || '',
    content: rule?.content || '',
    priority: rule?.priority ?? 0,
    active: rule?.active !== undefined ? Boolean(rule.active) : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-zinc-400">Kategoria</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Priorytet</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-zinc-400">Tytuł reguły</span>
        <input
          required
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        <span className="text-zinc-400">Treść (AI Reżyser czyta to przy każdej scenie)</span>
        <textarea
          required
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        Aktywna
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? 'Zapisuję…' : rule ? 'Zapisz' : 'Dodaj regułę'}
        </button>
        {rule && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-800 px-4 py-2 text-sm text-red-300 hover:bg-red-950"
          >
            Usuń
          </button>
        )}
      </div>
    </form>
  );
}
