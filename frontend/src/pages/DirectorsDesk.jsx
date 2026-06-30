import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import SeriesBrainSidebar from '../components/directorDesk/SeriesBrainSidebar.jsx';
import ChatCenter from '../components/directorDesk/ChatCenter.jsx';
import SceneWorkbench from '../components/SceneWorkbench.jsx';
import PlanReadinessPanel from '../components/directorDesk/PlanReadinessPanel.jsx';
import ProductionPanel from '../components/directorDesk/ProductionPanel.jsx';

const SUGGESTIONS_BY_STEP = {
  series_start: ['Kebabkiller Poczatki, klimat realistyczny z humorem', 'Zmień nazwę serialu na: '],
  series_style: ['Hiperrealizm z kreskówkowymi nóżkami', 'Styl: realistyczne tła, animowane postacie', 'Zatwierdzam styl'],
  series_canon_assets: ['Dodaj do kanonu asset Kebabkiller', 'Dodaj do kanonu asset Piec_Brick', 'Zatwierdzam assety'],
  series_confirm: ['Zatwierdzam kanon i idę dalej'],
  series_complete: ['Stwórz nowy odcinek o tytule Pierwsza Krew', 'Stwórz odcinek E01'],
  episode_start: ['Kebabkiller wyskakuje z pieca i rzuca cień na kebab_clasic', 'Stwórz odcinek z 3 scenami'],
  episode_logline: ['Logline: Kebabkiller spotyka swojego rywala', 'Zatwierdzam logline'],
  episode_storyboard: ['Rozbij na 3 sceny', 'Scena 1: zbliżenie na kebabkillera przed piecem', 'Zatwierdzam storyboard'],
  episode_assets: ['Assety są gotowe, idź dalej', 'Potrzebuję tło dla sceny 2'],
  episode_review: ['Zatwierdzam plan odcinka'],
  episode_complete: ['Uruchom produkcję GPU', 'Pokaż podgląd workflow'],
  free_mode: ['Stwórz nowy odcinek', 'Zmień opis sceny 1', 'Uruchom produkcję GPU'],
};

function extractCreatedEpisodeId(toolResults) {
  if (!toolResults?.length) return null;
  for (const entry of toolResults) {
    if (
      (entry.tool === 'startEpisodeWizard' || entry.tool === 'createEpisodePlan')
      && entry.result?.id
    ) {
      return entry.result.id;
    }
  }
  return null;
}

export default function DirectorsDesk() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const episodePlanId = searchParams.get('episode') || null;

  const [state, setState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 640);
  const [error, setError] = useState('');
  const [episodes, setEpisodes] = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const productionPanelRef = useRef(null);
  const workbenchRef = useRef(null);

  const refresh = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [data, eps] = await Promise.all([
        api.directorDesk.getState(projectId, episodePlanId),
        api.projects.episodes(projectId).catch(() => []),
      ]);
      setState(data);
      setMessages(data.chat || []);
      setEpisodes(eps || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, episodePlanId]);

  const refreshBrain = useCallback(async () => {
    try {
      const data = await api.directorDesk.getState(projectId, episodePlanId);
      setState(data);
    } catch (err) {
      setError(err.message);
    }
  }, [projectId, episodePlanId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (episodePlanId || !episodes.length) return;
    const drafts = episodes.filter((e) => e.status === 'szkic' || e.status === 'gotowy_do_akceptacji');
    if (drafts.length === 1) {
      navigate(`/desk/${projectId}?episode=${drafts[0].id}`, { replace: true });
    }
  }, [episodePlanId, episodes, navigate, projectId]);

  useEffect(() => {
    api.assets.list().then(setAllAssets).catch(() => setAllAssets([]));
  }, []);

  const characterAssets = useMemo(
    () => allAssets.filter((a) => a.type === 'character' && a.images?.length),
    [allAssets],
  );
  const locationAssets = useMemo(
    () => allAssets.filter((a) => a.type === 'location' && a.images?.length),
    [allAssets],
  );

  const episodeScenes = useMemo(() => {
    const scenes = state?.brain?.episode?.scenes || [];
    return scenes.slice().sort((a, b) => a.sort_order - b.sort_order);
  }, [state?.brain?.episode?.scenes]);

  useEffect(() => {
    if (!episodePlanId) {
      setSelectedSceneId(null);
      return;
    }
    if (episodeScenes.length === 0) {
      setSelectedSceneId(null);
      return;
    }
    setSelectedSceneId((prev) => (
      prev && episodeScenes.some((s) => s.id === prev) ? prev : episodeScenes[0].id
    ));
  }, [episodePlanId, episodeScenes]);

  const suggestions = useMemo(() => {
    const step = state?.wizard?.step || 'series_start';
    return SUGGESTIONS_BY_STEP[step] || SUGGESTIONS_BY_STEP.free_mode;
  }, [state?.wizard?.step]);

  async function handleSend(message, confirmAction) {
    setSending(true);
    setError('');
    try {
      const result = await api.directorDesk.sendMessage(projectId, {
        message,
        episode_plan_id: episodePlanId,
        confirm_action: confirmAction,
      });
      setState((prev) => ({
        ...prev,
        brain: result.brain,
        wizard: result.wizard,
      }));
      setMessages((prev) => [...prev, ...(result.messages || [])]);

      const newEpisodeId = extractCreatedEpisodeId(result.tool_results);
      if (newEpisodeId && newEpisodeId !== episodePlanId) {
        api.projects.episodes(projectId).then(setEpisodes).catch(() => {});
        navigate(`/desk/${projectId}?episode=${newEpisodeId}`);
        setTimeout(() => workbenchRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
        return;
      }

      if (result.tool_results?.some((r) => r.tool === 'startEpisodeWizard' || r.tool === 'createEpisodePlan')) {
        api.projects.episodes(projectId).then(setEpisodes).catch(() => {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const planStatus = state?.brain?.episode?.status || null;
  const episodeLogline = state?.brain?.episode?.logline || '';

  if (loading && !state) {
    return <p className="text-zinc-400">Ładowanie stołu reżyserskiego…</p>;
  }

  return (
    <div className="director-desk-layout">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Director&apos;s Desk</p>
          <h1 className="text-xl font-bold text-amber-400">{state?.brain?.project?.name || 'Projekt'}</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm items-center">
          <Link to="/projects" className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:bg-zinc-900">
            ← Seriale
          </Link>
          {episodes.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-600">Odcinki:</span>
              {episodes.map((ep) => (
                <Link
                  key={ep.id}
                  to={`/desk/${projectId}?episode=${ep.id}`}
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                    episodePlanId === ep.id
                      ? 'bg-amber-500 text-zinc-950'
                      : 'border border-zinc-700 text-zinc-400 hover:border-amber-600 hover:text-amber-300'
                  }`}
                >
                  {ep.code || ep.title}
                </Link>
              ))}
              {!episodePlanId && (
                <span className="text-xs text-zinc-600 ml-1">← kliknij odcinek aby pracować</span>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      {!episodePlanId && episodes.length > 1 && (
        <p className="mb-4 rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-2 text-sm text-amber-200">
          Wybierz odcinek w nagłówku, aby edytować sceny i uruchomić produkcję.
        </p>
      )}

      {episodePlanId && (
        <>
          <PlanReadinessPanel
            episodePlanId={episodePlanId}
            planStatus={planStatus}
            logline={episodeLogline}
            scenes={episodeScenes}
            onAccepted={() => refreshBrain()}
            onProductionStarted={() => {
              refreshBrain();
              productionPanelRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
          <ProductionPanel
            episodePlanId={episodePlanId}
            planStatus={planStatus}
            onRefresh={() => refreshBrain()}
            scrollRef={productionPanelRef}
          />
        </>
      )}

      {episodePlanId && (
        <div ref={workbenchRef}>
        <SceneWorkbench
          planId={episodePlanId}
          planStatus={planStatus}
          scenes={episodeScenes}
          selectedSceneId={selectedSceneId}
          onSceneChange={setSelectedSceneId}
          characterAssets={characterAssets}
          locationAssets={locationAssets}
          storyboard={state?.brain?.storyboard}
          wizardStep={state?.wizard?.step}
          onSceneSaved={refreshBrain}
        />
        </div>
      )}

      <div className="director-desk-grid">
        <SeriesBrainSidebar
          brain={state?.brain}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
        />
        <div className="flex h-full flex-col">
          <ChatCenter
            messages={messages}
            wizard={state?.wizard}
            suggestions={suggestions}
            onSend={handleSend}
            onConfirm={(props) => handleSend('Akceptuję zmianę', { summary: props.summary, action: props.action })}
            onProductionStarted={() => {
              productionPanelRef.current?.scrollIntoView({ behavior: 'smooth' });
              refreshBrain();
            }}
            loading={sending}
          />
        </div>
      </div>

    </div>
  );
}
