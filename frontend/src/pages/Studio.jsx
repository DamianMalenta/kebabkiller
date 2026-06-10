import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import SeriesMemoryPanel from '../components/SeriesMemoryPanel.jsx';

export default function Studio() {
  const [characters, setCharacters] = useState([]);
  const [backgrounds, setBackgrounds] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [episodes, setEpisodes] = useState([]);
  const [episodeId, setEpisodeId] = useState('');
  const [prompt, setPrompt] = useState(
    'Kebabkiller siedzi w rozżarzonym piecu ceglanym. Nagle sztywno wyskakuje na stalowy blat — krótki skok jak bryła, ląduje i lekko się przechyla. Kamera zaczyna od zbliżenia na postać na blacie, potem wolno się oddala. Za kebabkillerem na ścianie pieca powstaje wielki, dramatyczny cień.',
  );
  const [characterId, setCharacterId] = useState('');
  const [backgroundId, setBackgroundId] = useState('');
  const [directorPlan, setDirectorPlan] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingRender, setLoadingRender] = useState(false);
  const [lastJob, setLastJob] = useState(null);
  const [error, setError] = useState('');

  const selectedProject = projects.find((p) => p.id === projectId);

  useEffect(() => {
    Promise.all([api.characters.list(), api.backgrounds.list(), api.projects.list()])
      .then(([chars, bgs, projs]) => {
        setCharacters(chars);
        setBackgrounds(bgs);
        setProjects(projs);
        if (chars[0]) setCharacterId(chars[0].id);
        if (bgs[0]) setBackgroundId(bgs[0].id);
        if (projs[0]) setProjectId(projs[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setEpisodes([]);
      setEpisodeId('');
      return;
    }
    api.projects.episodes(projectId)
      .then((eps) => {
        setEpisodes(eps);
        setEpisodeId('');
      })
      .catch((err) => {
        setEpisodes([]);
        setEpisodeId('');
        setError(err.message);
      });
  }, [projectId]);

  async function handlePreview() {
    setLoadingPreview(true);
    setError('');
    try {
      const plan = await api.director.preview({
        prompt,
        character_id: characterId || undefined,
        background_id: backgroundId || undefined,
        project_id: projectId || undefined,
        episode_id: episodeId || undefined,
      });
      setDirectorPlan(plan);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleRender() {
    setLoadingRender(true);
    setError('');
    try {
      let plan = directorPlan;
      if (!plan) {
        plan = await api.director.preview({
          prompt,
          character_id: characterId || undefined,
          background_id: backgroundId || undefined,
          project_id: projectId || undefined,
          episode_id: episodeId || undefined,
        });
        setDirectorPlan(plan);
      }
      const job = await api.jobs.create({
        prompt,
        character_id: characterId || undefined,
        background_id: backgroundId || undefined,
        project_id: projectId || undefined,
        episode_id: episodeId || undefined,
        director_plan: plan,
      });
      setLastJob(job);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRender(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Studio Reżysera</h1>
        <p className="mt-2 text-zinc-400">
          Opisz scenę po polsku. Najpierw zobacz jak AI Reżyser ją rozumie, potem uruchom render.
        </p>
      </header>

      {error && <p className="rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <label className="block text-sm">
            <span className="text-zinc-400">Projekt serialu</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.length === 0 && (
                <option value="">Brak projektów</option>
              )}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="mt-1 text-xs text-amber-300">
                <Link to="/projects" className="underline hover:text-amber-200">Utwórz projekt serialu</Link>
                {' '}w panelu Seriale.
              </p>
            )}
          </label>

          {projectId && episodes.length > 0 && (
            <label className="block text-sm">
              <span className="text-zinc-400">Odcinek (opcjonalnie)</span>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                value={episodeId}
                onChange={(e) => setEpisodeId(e.target.value)}
              >
                <option value="">— bez przypisania —</option>
                {episodes.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    #{ep.episode_number} — {ep.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {projectId && (
            <SeriesMemoryPanel
              projectId={projectId}
              projectName={selectedProject?.name}
            />
          )}

          <label className="block text-sm">
            <span className="text-zinc-400">Opis sceny (PL)</span>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="text-zinc-400">Postać</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-zinc-400">Tło</span>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={backgroundId}
              onChange={(e) => setBackgroundId(e.target.value)}
            >
              {backgrounds.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePreview}
              disabled={loadingPreview || !prompt.trim()}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
            >
              {loadingPreview ? 'Analizuję…' : 'Pokaż jak zrozumiałeś'}
            </button>
            <button
              onClick={handleRender}
              disabled={loadingRender || !prompt.trim()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {loadingRender ? 'Uruchamiam…' : 'Generuj wideo'}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-lg font-semibold">Plan AI Reżysera</h2>
          {!directorPlan ? (
            <p className="mt-4 text-sm text-zinc-500">
              Kliknij „Pokaż jak zrozumiałeś”, aby zobaczyć techniczny plan przed renderem.
            </p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              <Field label="Strategia" value={directorPlan.render_strategy} />

              {directorPlan.cinematography && (
                <div>
                  <p className="text-zinc-500">Kamera i Oświetlenie</p>
                  <ul className="mt-1 list-inside list-disc text-zinc-300">
                    <li>Ujęcie: {directorPlan.cinematography.camera_shot}</li>
                    <li>Ruch: {directorPlan.cinematography.camera_motion}</li>
                    <li>Światło: {directorPlan.cinematography.lighting}</li>
                  </ul>
                </div>
              )}

              <Field label="Positive prompt" value={directorPlan.positive_prompt} />
              <Field label="Negative prompt" value={directorPlan.negative_prompt} />
              <Field label="Fizyka" value={directorPlan.motion_physics} />
              {directorPlan.storyboard && (
                <div>
                  <p className="text-zinc-500">Storyboard</p>
                  <ul className="mt-1 list-inside list-disc text-zinc-300">
                    <li>Start: {directorPlan.storyboard.start}</li>
                    <li>Mid: {directorPlan.storyboard.mid}</li>
                    <li>End: {directorPlan.storyboard.end}</li>
                  </ul>
                </div>
              )}
              {directorPlan._source && (
                <p className={`text-xs font-medium ${
                  directorPlan._source === 'mock' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  Źródło AI: {directorPlan._source}
                  {directorPlan._source === 'mock' && directorPlan._llm_error && (
                    <span className="block mt-1 text-red-400 font-normal">
                      Błąd LLM: {directorPlan._llm_error}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {lastJob && (
        <div className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-4">
          <p className="font-medium text-emerald-300">Zlecenie utworzone</p>
          <p className="mt-1 text-sm text-zinc-400">
            ID: {lastJob.id} · Status: {lastJob.status}
            {projectId && selectedProject && ` · Projekt: ${selectedProject.name}`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Śledź postęp na Dashboard. Po ukończeniu użyj „Zatwierdź Kanon”, aby zaktualizować pamięć serialową.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-zinc-300">{value}</p>
    </div>
  );
}
