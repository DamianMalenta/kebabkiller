import { useState } from 'react';
import KlatkaZeroPanel from './KlatkaZeroPanel.jsx';
import { SceneContinuityRow } from './ContinuityPicker.jsx';
import { SceneCard } from './directorDesk/ChatWidgets.jsx';

const TABS = [
  {
    id: 'identity',
    label: 'Tożsamość',
    hint: 'Wybierz postać i tło — to kontrakt tożsamości i fizyki sceny dla GPU.',
  },
  {
    id: 'storyboard',
    label: 'Storyboard',
    hint: 'Opis sceny i podgląd warstw z planu odcinka (negocjowany w czacie).',
  },
  {
    id: 'continuity',
    label: 'Ciągłość',
    hint: 'Sceny od 2. startują z kadru poprzedniej — domyślnie klatka końcowa.',
  },
];

export default function SceneWorkbench({
  planId,
  scenes = [],
  selectedSceneId,
  onSceneChange,
  characterAssets = [],
  locationAssets = [],
  storyboard = null,
  wizardStep = null,
  onSceneSaved,
}) {
  const [activeTab, setActiveTab] = useState('identity');

  if (!planId) return null;

  const sortedScenes = scenes.slice().sort((a, b) => a.sort_order - b.sort_order);
  const selectedScene = sortedScenes.find((s) => s.id === selectedSceneId) || null;
  const sceneIndex = selectedScene ? sortedScenes.indexOf(selectedScene) : -1;

  const storyboardScene =
    storyboard?.scenes?.find((s) => s.scene_id === selectedSceneId)
    ?? (sceneIndex >= 0 ? storyboard?.scenes?.[sceneIndex] : null);

  const hasCatalogAssets = characterAssets.length > 0 && locationAssets.length > 0;
  const showProduceHint = wizardStep === 'episode_complete';

  if (sortedScenes.length === 0) {
    return (
      <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Panel sceny</p>
        <h2 className="mt-1 text-lg font-bold text-amber-400">Scena — brak planu</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Odcinek nie ma jeszcze scen. Napisz w czacie np. „Rozbij na 3 sceny” lub opisz pierwszą scenę.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
      {/* Scene picker */}
      <div className="border-b border-zinc-800 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Panel sceny</p>
            <h2 className="text-lg font-bold text-amber-400">
              Scena {sceneIndex + 1}
              {selectedScene?.description_pl && (
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  {selectedScene.description_pl.slice(0, 56)}
                </span>
              )}
            </h2>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Przełącz:</span>
            <select
              value={selectedSceneId || ''}
              onChange={(e) => onSceneChange?.(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-200"
            >
              {sortedScenes.map((scene, idx) => (
                <option key={scene.id} value={scene.id}>
                  Scena {idx + 1}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const disabled = tab.id === 'continuity' && sceneIndex <= 0;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={disabled}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  activeTab === tab.id
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <p className="pb-3 text-xs text-zinc-500">
          {TABS.find((t) => t.id === activeTab)?.hint}
        </p>
      </div>

      {/* Tab content */}
      <div className="p-4 sm:p-6">
        {activeTab === 'identity' && (
          hasCatalogAssets ? (
            <KlatkaZeroPanel
              embedded
              characterAssets={characterAssets}
              locationAssets={locationAssets}
              planId={planId}
              sceneId={selectedSceneId}
              scene={selectedScene}
              onSaved={onSceneSaved}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-sm text-zinc-400">
              <p className="font-medium text-zinc-300">Brak materiałów w katalogu</p>
              <p className="mt-2">
                Dodaj co najmniej jedną <strong className="text-zinc-200">postać</strong> i jedną{' '}
                <strong className="text-zinc-200">lokację</strong> ze zdjęciem w{' '}
                <a href="/catalog" className="text-amber-400 hover:underline">Katalogu</a>.
              </p>
            </div>
          )
        )}

        {activeTab === 'storyboard' && (
          storyboardScene ? (
            <SceneCard scene={storyboardScene} />
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-sm text-zinc-400">
              <p>Brak podglądu storyboardu dla tej sceny.</p>
              <p className="mt-2 text-xs text-zinc-500">
                Ustal sceny w czacie (krok „Sceny storyboard”), potem wróć tutaj.
              </p>
            </div>
          )
        )}

        {activeTab === 'continuity' && (
          sceneIndex > 0 && selectedScene ? (
            <SceneContinuityRow
              planId={planId}
              scene={selectedScene}
              showProduceHint={showProduceHint}
            />
          ) : (
            <p className="text-sm text-zinc-500">
              Scena 1 nie wymaga kadru kontynuacji — użyj zakładki Tożsamość (Klatka Zero).
            </p>
          )
        )}
      </div>
    </section>
  );
}
