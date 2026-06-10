import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';

const STATUS_LABELS = {
  szkic: 'Szkic',
  brakuje_materialow: 'Brakuje materiałów',
  gotowy_do_akceptacji: 'Gotowy do akceptacji',
  zaakceptowany: 'Zaakceptowany',
  w_produkcji: 'W produkcji',
  gotowy: 'Gotowy',
};

export default function EpisodePlan() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [assets, setAssets] = useState([]);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [production, setProduction] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [planData, assetsData, validationData, productionData] = await Promise.all([
      api.episodePlans.get(id),
      api.assets.list(),
      api.episodePlans.validate(id),
      api.episodePlans.production(id).catch(() => null),
    ]);
    setPlan(planData);
    setAssets(assetsData);
    setValidation(validationData);
    setProduction(productionData);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    const interval = setInterval(() => {
      if (['w_produkcji', 'zaakceptowany'].includes(plan?.status)) {
        api.episodePlans.production(id).then(setProduction).catch(() => {});
        api.episodePlans.get(id).then(setPlan).catch(() => {});
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, plan?.status]);

  async function savePlanFields(fields) {
    setBusy(true);
    setError('');
    try {
      const updated = await api.episodePlans.update(id, fields);
      setPlan(updated);
      const v = await api.episodePlans.validate(id);
      setValidation(v);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveScenes(scenes) {
    setBusy(true);
    try {
      const result = await api.episodePlans.replaceScenes(id, scenes);
      setPlan(result.plan);
      setValidation(await api.episodePlans.validate(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function updateScene(index, patch) {
    const scenes = plan.scenes.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setPlan({ ...plan, scenes });
  }

  async function addScene() {
    const scenes = [
      ...plan.scenes,
      {
        description_pl: '',
        duration_sec: 4,
        asset_id: null,
        asset_image_id: null,
        location_asset_id: null,
      },
    ];
    await saveScenes(scenes);
  }

  async function removeScene(index) {
    const scenes = plan.scenes.filter((_, i) => i !== index);
    await saveScenes(scenes);
  }

  async function persistScenes() {
    await saveScenes(plan.scenes);
  }

  async function askScreenwriter(apply) {
    if (!chatInput.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.episodePlans.assist(id, { message: chatInput, apply });
      setChatLog((prev) => [...prev, { role: 'user', text: chatInput }, { role: 'assistant', text: result.assistant_message }]);
      setChatInput('');
      if (result.plan) {
        setPlan(result.plan);
        setValidation(await api.episodePlans.validate(id));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function acceptPlan() {
    setBusy(true);
    setError('');
    try {
      const result = await api.episodePlans.accept(id, { start_production: true });
      setPlan(result);
      setValidation(await api.episodePlans.validate(id));
      setProduction(await api.episodePlans.production(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function restartProduction() {
    setBusy(true);
    setError('');
    try {
      await api.episodePlans.produce(id);
      setProduction(await api.episodePlans.production(id));
      setPlan(await api.episodePlans.get(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolveDeliverable(deliverableId, file) {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('asset_name', `Dostarczone_${Date.now()}`);
    fd.append('asset_type', 'prop');
    const result = await api.episodePlans.resolveDeliverable(deliverableId, fd);
    setPlan(result.plan);
    setValidation(await api.episodePlans.validate(id));
  }

  if (!plan) {
    return <p className="text-zinc-400">Ładowanie planu odcinka…</p>;
  }

  const canAccept = validation?.ok && plan.status !== 'zaakceptowany';

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link to="/" className="hover:text-amber-400">Dashboard</Link>
            {' · '}
            Plan odcinka
          </p>
          <h1 className="text-3xl font-bold text-zinc-50">{plan.code} — {plan.title || 'Bez tytułu'}</h1>
          <p className="mt-1 text-sm text-amber-300">
            Status: {STATUS_LABELS[plan.status] || plan.status}
          </p>
        </div>
        <button
          type="button"
          disabled={!canAccept || busy}
          onClick={acceptPlan}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Akceptuj plan
        </button>
      </header>

      {error && <p className="rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}

      {validation && !validation.ok && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4">
          <p className="font-medium text-amber-200">Walidacja planu</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-100/90">
            {validation.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Pomysł odcinka</h2>
        <label className="block text-sm">
          <span className="text-zinc-400">Logline</span>
          <textarea
            value={plan.logline || ''}
            onChange={(e) => setPlan({ ...plan, logline: e.target.value })}
            onBlur={() => savePlanFields({ logline: plan.logline })}
            rows={2}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Preferencje (wspólny tekst)</span>
          <textarea
            value={plan.preferences || ''}
            onChange={(e) => setPlan({ ...plan, preferences: e.target.value })}
            onBlur={() => savePlanFields({ preferences: plan.preferences })}
            rows={3}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block text-sm w-40">
          <span className="text-zinc-400">Cel (s)</span>
          <input
            type="number"
            value={plan.target_duration_sec}
            onChange={(e) => setPlan({ ...plan, target_duration_sec: Number(e.target.value) })}
            onBlur={() => savePlanFields({ target_duration_sec: plan.target_duration_sec })}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sceny</h2>
          <div className="flex gap-2">
            <button type="button" onClick={addScene} className="rounded-lg border border-zinc-600 px-3 py-1 text-sm">+ Scena</button>
            <button type="button" onClick={persistScenes} disabled={busy} className="rounded-lg bg-zinc-800 px-3 py-1 text-sm">Zapisz sceny</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Opis PL</th>
                <th className="py-2 pr-2">Czas</th>
                <th className="py-2 pr-2">Asset</th>
                <th className="py-2 pr-2">Lokacja</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {plan.scenes.map((scene, index) => (
                <tr key={scene.id || index} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-2 text-zinc-500">{index + 1}</td>
                  <td className="py-2 pr-2">
                    <input
                      value={scene.description_pl || ''}
                      onChange={(e) => updateScene(index, { description_pl: e.target.value })}
                      className="w-full min-w-[200px] rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      step="0.5"
                      min="2"
                      max="10"
                      value={scene.duration_sec}
                      onChange={(e) => updateScene(index, { duration_sec: Number(e.target.value) })}
                      className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={scene.asset_id || ''}
                      onChange={(e) => updateScene(index, { asset_id: e.target.value || null })}
                      className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                    >
                      <option value="">—</option>
                      {assets.filter((a) => a.type === 'character' || a.type === 'prop').map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={scene.location_asset_id || ''}
                      onChange={(e) => updateScene(index, { location_asset_id: e.target.value || null })}
                      className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                    >
                      <option value="">—</option>
                      {assets.filter((a) => a.type === 'location').map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    <button type="button" onClick={() => removeScene(index)} className="text-red-400 text-xs">Usuń</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Do dostarczenia</h2>
        {plan.deliverables?.length === 0 && (
          <p className="text-sm text-zinc-500">Brak otwartych pozycji — Scenarzysta wskaże braki przy planowaniu.</p>
        )}
        <ul className="space-y-3">
          {plan.deliverables?.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 p-3">
              <span className={d.status === 'resolved' ? 'text-zinc-500 line-through' : 'text-zinc-200'}>
                {d.description}
              </span>
              {d.status === 'open' && (
                <label className="cursor-pointer rounded-lg bg-zinc-800 px-3 py-1 text-xs hover:bg-zinc-700">
                  Wrzuć JPG
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && resolveDeliverable(d.id, e.target.files[0])}
                  />
                </label>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Produkcja</h2>
          {['zaakceptowany', 'gotowy', 'w_produkcji'].includes(plan.status) && (
            <button
              type="button"
              disabled={busy || plan.status === 'w_produkcji'}
              onClick={restartProduction}
              className="rounded-lg border border-zinc-600 px-3 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40"
            >
              {plan.status === 'w_produkcji' ? 'Render w toku…' : 'Uruchom ponownie'}
            </button>
          )}
        </div>
        {!production?.production && (
          <p className="text-sm text-zinc-500">
            Po akceptacji planu Reżyser produkcji renderuje sceny i buduje paczkę montażową.
          </p>
        )}
        {production?.production && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-zinc-400">Postęp:</span>
              <div className="h-2 flex-1 rounded-full bg-zinc-800">
                <div
                  className="h-2 rounded-full bg-amber-500 transition-all"
                  style={{ width: `${production.production.progress || 0}%` }}
                />
              </div>
              <span className="text-amber-300">{production.production.progress || 0}%</span>
            </div>
            <ul className="space-y-2">
              {production.production.clips?.map((clip) => (
                <li key={clip.id} className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm">
                  <span className="text-zinc-200">{clip.clip_code}</span>
                  <span className={
                    clip.status === 'completed' ? 'text-emerald-400'
                      : clip.status === 'failed' ? 'text-red-400'
                        : 'text-zinc-500'
                  }>
                    {clip.status}
                  </span>
                  {clip.output_path && (
                    <a
                      href={clip.output_path}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-amber-400 hover:underline"
                    >
                      podgląd
                    </a>
                  )}
                </li>
              ))}
            </ul>
            {production.production.manifest_path && (
              <p className="text-xs text-zinc-500">
                Paczka: <code className="text-zinc-400">{production.production.export_dir}</code>
                {' · '}
                <a href={production.production.manifest_path.replace(/^.*\/output/, '/output')} className="text-amber-400 hover:underline">
                  manifest
                </a>
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Scenarzysta</h2>
        <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg bg-zinc-950 p-3">
          {chatLog.length === 0 && (
            <p className="text-sm text-zinc-500">Opisz pomysł odcinka — Scenarzysta zaproponuje sceny i braki materiałów.</p>
          )}
          {chatLog.map((msg, i) => (
            <p key={i} className={`text-sm ${msg.role === 'user' ? 'text-amber-200' : 'text-zinc-300'}`}>
              <strong>{msg.role === 'user' ? 'Ty' : 'Scenarzysta'}:</strong> {msg.text}
            </p>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Np. Odcinek 45 s: Kebabkiller w piecu, potem upadek…"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button type="button" disabled={busy} onClick={() => askScreenwriter(false)} className="rounded-lg border border-zinc-600 px-3 py-2 text-sm">
            Zapytaj
          </button>
          <button type="button" disabled={busy} onClick={() => askScreenwriter(true)} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950">
            Zastosuj propozycję
          </button>
        </div>
      </section>

      <p className="text-xs text-zinc-600">
        Scenarzysta — doprecyzowanie promptów i UX w backlogu. Legacy Studio (
        <button type="button" onClick={() => navigate('/studio')} className="text-amber-500 hover:underline">/studio</button>
        ) nadal dostępne.
      </p>
    </div>
  );
}
