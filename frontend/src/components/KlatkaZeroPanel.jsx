import React, { useState, useEffect } from 'react';

export default function KlatkaZeroPanel({ characterAssets = [], locationAssets = [], planId, sceneId }) {
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [compositionText, setCompositionText] = useState('');

  // Reset local state upon scene switch to enforce Mirror Validation
  useEffect(() => {
    setSelectedCharacterId(null);
    setSelectedLocationId(null);
    setCompositionText('');
  }, [sceneId]);

  const handleSave = () => {
    console.log('Payload Klatki Zero gotowy do wysyłki:', {
      planId,
      sceneId,
      selectedCharacterId,
      selectedLocationId,
      compositionText,
    });
    // TODO: Wpięcie zapisu do bazy SQLite / asynchronicznie przez Redis
  };

  if (!planId || !sceneId) return null;

  return (
    <div className="flex flex-col gap-6 p-6 rounded-xl bg-zinc-950 border border-zinc-800 shadow-2xl">

      {/* Nagłówek Silosu */}
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-lg font-semibold text-zinc-100 tracking-wide uppercase">Klatka Zero</h2>
        <p className="text-xs text-zinc-500 mt-1 font-mono">SCENE_ID: {sceneId}</p>
      </div>

      {/* SEKCJA A: AKTOR (IP-Adapter Target) */}
      <div className="space-y-3">
        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">1. Tożsamość (Aktor)</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {characterAssets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => setSelectedCharacterId(asset.id)}
              className={`group relative aspect-[3/4] overflow-hidden rounded-lg border-2 transition-all duration-200 ease-in-out ${
                selectedCharacterId === asset.id
                  ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <img
                src={(asset.images?.find((i) => i.is_primary) || asset.images?.[0])?.path}
                alt={asset.name}
                className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 pt-6 text-[10px] text-center font-medium text-zinc-200 tracking-wide">
                {asset.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* SEKCJA B: SCENOGRAFIA (ControlNet Depth Target) */}
      <div className="space-y-3">
        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">2. Fizyka (Scenografia 3D)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {locationAssets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => setSelectedLocationId(asset.id)}
              className={`group relative aspect-video overflow-hidden rounded-lg border-2 transition-all duration-200 ease-in-out ${
                selectedLocationId === asset.id
                  ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                  : 'border-zinc-800 hover:border-zinc-600'
              }`}
            >
              <img
                src={(asset.images?.find((i) => i.is_primary) || asset.images?.[0])?.path}
                alt={asset.name}
                className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 pt-6 text-[10px] text-center font-medium text-zinc-200 tracking-wide">
                {asset.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* SEKCJA C: KOMPOZYCJA (Prompt Override) */}
      <div className="space-y-3">
        <h3 className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">3. Override (Kompozycja / Kamera)</h3>
        <textarea
          value={compositionText}
          onChange={(e) => setCompositionText(e.target.value)}
          placeholder="Instrukcje omijające dla modelu (np. ujęcie z dołu, makro, dym, agresywny ruch)..."
          className="w-full h-24 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 focus:bg-zinc-900 transition-colors resize-none"
        />
      </div>

      {/* AKCJA: ZATWIERDZENIE KONTRAKTU */}
      <div className="pt-4 flex justify-end border-t border-zinc-800/50">
        <button
          onClick={handleSave}
          disabled={!selectedCharacterId || !selectedLocationId}
          className="px-6 py-2 bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Zablokuj Parametry Sceny
        </button>
      </div>

    </div>
  );
}
