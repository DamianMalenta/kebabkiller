/** Cheap visual storyboard from catalog assets — no GPU. */

import { getAsset } from '../../db/episodeModels.js';

function parseOverrides(scene) {
  if (scene.ai_overrides) return scene.ai_overrides;
  if (!scene.ai_overrides_json) return {};
  try {
    return JSON.parse(scene.ai_overrides_json);
  } catch {
    return {};
  }
}

function pickImage(asset, preferredImageId) {
  if (!asset?.images?.length) return null;
  if (preferredImageId) {
    const found = asset.images.find((i) => i.id === preferredImageId);
    if (found) return found;
  }
  return asset.images.find((i) => i.is_primary) || asset.images[0];
}

export function buildSceneStoryboardMock(scene, { sceneIndex = 0 } = {}) {
  const character = scene.asset_id ? getAsset(scene.asset_id) : null;
  const location = scene.location_asset_id ? getAsset(scene.location_asset_id) : null;

  const charImage = pickImage(character, scene.asset_image_id);
  const locImage = pickImage(location);

  const layers = [];
  if (locImage) {
    layers.push({
      role: 'background',
      asset_id: location?.id,
      image_id: locImage.id,
      path: locImage.path,
      label: location?.name || 'Tło',
    });
  }
  if (charImage) {
    layers.push({
      role: 'character',
      asset_id: character?.id,
      image_id: charImage.id,
      path: charImage.path,
      label: character?.name || 'Bohater',
    });
  }

  const overrides = parseOverrides(scene);
  const mock = {
    scene_id: scene.id,
    scene_index: sceneIndex,
    description_pl: scene.description_pl,
    duration_sec: scene.duration_sec,
    layers,
    camera: overrides.camera || 'medium shot',
    mood: overrides.mood || null,
    status: layers.length >= 1 ? 'ready' : 'missing_assets',
    collage_hint: layers.map((l) => l.path).filter(Boolean),
    generated_at: new Date().toISOString(),
    source: 'mock',
  };

  return mock;
}

export function buildEpisodeStoryboardMock(plan) {
  const scenes = plan.scenes || [];
  return {
    episode_plan_id: plan.id,
    title: plan.title,
    scenes: scenes.map((scene, idx) => buildSceneStoryboardMock(scene, { sceneIndex: idx })),
    ready_count: scenes.filter((s) => buildSceneStoryboardMock(s).status === 'ready').length,
    total: scenes.length,
  };
}
