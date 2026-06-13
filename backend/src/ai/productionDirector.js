import { expandScenePrompt } from './director.js';
import { applyI2vProductionProfile } from './i2vProduction.js';
import { getAsset } from '../db/episodeModels.js';
import { getDb } from '../db/init.js';
import { WAN_FPS, WAN_QUALITY, parseI2vProfileId } from '../video/wanConfig.js';
import { inferKinematicsFromPolish } from './kinematicsFromPrompt.js';

const BASE_NEGATIVE =
  'low quality, watermark, text overlay, deformed background, melting texture, extra limbs, mutated, bad anatomy';

/** F2 always uses production profile; .env I2V_PROFILE=SMOKE must not weaken episode renders. */
const EPISODE_I2V_PROFILE = 'I2V_PRODUCTION';

function resolveEpisodeI2vProfile() {
  const fromEnv = parseI2vProfileId();
  return fromEnv === 'I2V_PRODUCTION' ? fromEnv : EPISODE_I2V_PROFILE;
}

/** One visual profile for the entire episode (F2). */
export function buildEpisodeVisualProfile(plan) {
  const catalogUsed = [];
  const seen = new Set();

  for (const scene of plan.scenes) {
    for (const assetId of [scene.asset_id, scene.location_asset_id]) {
      if (!assetId || seen.has(assetId)) continue;
      seen.add(assetId);
      const asset = getAsset(assetId);
      if (asset) {
        catalogUsed.push({
          id: asset.id,
          type: asset.type,
          name: asset.name,
          canon_en: asset.canon_en,
        });
      }
    }
  }

  return {
    i2v_profile: resolveEpisodeI2vProfile(),
    fps: WAN_FPS,
    resolution: { width: WAN_QUALITY.width, height: WAN_QUALITY.height },
    preferences: plan.preferences || '',
    negative_prompt: BASE_NEGATIVE,
    catalog_used: catalogUsed,
    static_camera: true,
  };
}

function resolveSceneAssetRefs(scene) {
  const characterAsset = scene.asset_id ? getAsset(scene.asset_id) : null;
  const locationAsset = scene.location_asset_id ? getAsset(scene.location_asset_id) : null;

  const charImage = scene.asset_image_id
    ? getDb().prepare('SELECT * FROM asset_images WHERE id = ?').get(scene.asset_image_id)
    : characterAsset?.images?.find((i) => i.is_primary) || characterAsset?.images?.[0];

  const locImage = locationAsset?.images?.find((i) => i.is_primary) || locationAsset?.images?.[0];

  return {
    characterAsset,
    locationAsset,
    characterRef: charImage?.path || null,
    backgroundRef: locImage?.path || null,
    legacyCharacterId: characterAsset?.legacy_character_id || null,
    legacyBackgroundId: locationAsset?.legacy_background_id || null,
  };
}

function buildSceneUserPrompt(plan, scene) {
  // Wyrzucamy sklejanie całego kontekstu odcinka (logline) i preferencji do promptu.
  // Zostawiamy TYLKO czysty opis akcji tej konkretnej sceny.
  return scene.description_pl || '';
}

// Strips identity/environment text blocks from LLM prompt when composite refs are available.
// Prevents WAN 2.1 confusion between composite image and redundant text descriptions.
function stripRedundantTextBlocks(prompt, refs) {
  if (!prompt || !refs.characterAsset || !refs.locationAsset) return prompt;

  let cleaned = prompt;
  const stringsToRemove = [
    refs.characterAsset.canon_en,
    refs.characterAsset.description_pl,
    refs.locationAsset.canon_en,
    refs.locationAsset.description_pl,
  ].filter(Boolean);

  for (const s of stringsToRemove) {
    // Remove the string and any trailing ", " or ", "
    cleaned = cleaned.replace(new RegExp(`[,\\s]*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[,\\s]*`, 'g'), ', ').trim();
  }

  // Clean up multiple commas / leading-trailing commas
  return cleaned.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',').trim();
}

function enrichProductionPlan(directorPlan, scene, refs, visualProfile) {
  const i2vProfile = visualProfile.i2v_profile || EPISODE_I2V_PROFILE;
  const enriched = applyI2vProductionProfile(directorPlan, {
    i2vProfile,
    durationSec: scene.duration_sec,
  });

  enriched.character_ref = refs.characterRef || enriched.character_ref;
  enriched.background_ref = refs.backgroundRef || enriched.background_ref;
  enriched.i2v_profile = i2vProfile;
  
  enriched.episode_preferences = visualProfile.preferences;

  const hasComposite = Boolean(enriched.character_ref && enriched.background_ref);
  const canonParts = [];
  if (!hasComposite) {
    if (refs.characterAsset?.canon_en) canonParts.push(refs.characterAsset.canon_en);
    if (refs.locationAsset?.canon_en) canonParts.push(refs.locationAsset.canon_en);
  }
  
  // When composite is available: strip redundant identity/environment text the LLM already added
  // (LLM runs with legacy refs where reference_path=null, so it adds text descriptions to prompt)
  if (hasComposite && enriched.positive_prompt) {
    enriched.positive_prompt = stripRedundantTextBlocks(enriched.positive_prompt, refs);
  }

  // Dodajemy twarde preferencje stylu z Kanonu do promptu
  if (visualProfile.preferences) canonParts.push(visualProfile.preferences);

  if (canonParts.length > 0) {
    enriched.positive_prompt = [enriched.positive_prompt, ...canonParts].filter(Boolean).join(', ');
  }

  const negParts = [visualProfile.negative_prompt, enriched.negative_prompt]
    .join(', ')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  enriched.negative_prompt = Array.from(new Set(negParts)).join(', ');

  if (refs.locationAsset?.name) {
    enriched.location_name = refs.locationAsset.name;
  }

  // Extra fields for fal.ai engine (Kling prompt builder reads these)
  if (refs.characterAsset) {
    enriched.character_description = refs.characterAsset.canon_en || refs.characterAsset.description_pl || null;
  }
  if (refs.locationAsset) {
    enriched.background_description = refs.locationAsset.canon_en || refs.locationAsset.description_pl || null;
  }
  if (enriched.kinematics) {
    const k = enriched.kinematics;
    enriched.action_description = `${k.subject_state || 'standing'}, ${k.primary_motion || 'still'} motion at ${k.velocity || 'normal'} pace`;
  }

  return enriched;
}

function compileDeterministicScenePlan(userPrompt, scene, refs, visualProfile) {
  const kinematics = inferKinematicsFromPolish(userPrompt);
  const cinemaBlock = 'Cinematography: medium shot, static, natural light.';
  const kinematicBlock = `Action: The subject is ${kinematics.subject_state}. Motion: ${kinematics.primary_motion} at a ${kinematics.velocity} pace.`;

  const identityBlock = refs.characterAsset?.canon_en || refs.characterAsset?.description_pl || '';
  const environmentBlock = refs.locationAsset?.canon_en
    || (refs.locationAsset?.description_pl ? `Setting: ${refs.locationAsset.description_pl}.` : '');

  const hasComposite = Boolean(refs.characterRef && refs.backgroundRef);
  const positivePrompt = [
    cinemaBlock,
    'High quality, detailed, sharp focus',
    'Vertical 9:16 video, 480x832',
    ...(hasComposite ? [] : [environmentBlock, identityBlock]),
    kinematicBlock,
    visualProfile.preferences,
  ].filter(Boolean).join(', ');

  return enrichProductionPlan({
    scene_summary: scene.description_pl,
    render_strategy: 'native_i2v',
    cinematography: { camera_shot: 'medium shot', camera_motion: 'static', lighting: 'natural light' },
    kinematics,
    positive_prompt: positivePrompt,
    negative_prompt: BASE_NEGATIVE,
    character_ref: refs.characterRef,
    background_ref: refs.backgroundRef,
    _source: 'deterministic',
  }, scene, refs, visualProfile);
}

/** Build GPU director plan for a single scene from accepted episode plan. */
export async function buildSceneDirectorPlan(plan, scene, visualProfile) {
  const refs = resolveSceneAssetRefs(scene);
  const userPrompt = buildSceneUserPrompt(plan, scene);

  let directorPlan;
  try {
    directorPlan = await expandScenePrompt(userPrompt, {
      characterId: refs.legacyCharacterId,
      backgroundId: refs.legacyBackgroundId,
      i2vProfile: visualProfile.i2v_profile,
      durationSec: scene.duration_sec,
    });
  } catch (err) {
    console.warn('[ProductionDirector] LLM failed, using deterministic plan:', err.message);
    directorPlan = compileDeterministicScenePlan(userPrompt, scene, refs, visualProfile);
    return directorPlan;
  }

  return enrichProductionPlan(directorPlan, scene, refs, visualProfile);
}
