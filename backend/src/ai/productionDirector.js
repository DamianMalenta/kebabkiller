import { getAsset } from '../db/episodeModels.js';
import { getDb } from '../db/init.js';
import { WAN_FPS, WAN_QUALITY, parseI2vProfileId, resolveWanRenderParams } from '../video/wanConfig.js';
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

/**
 * JEDEN kanoniczny builder promptu sceny (Faza B) — w pełni deterministyczny, zero LLM.
 *
 * Stała kolejność bloków positive_prompt (jedno źródło prawdy dla podglądu i produkcji):
 *   1. Cinematography  2. Quality  3. Format 9:16
 *   4. [Environment, Identity] — TYLKO gdy brak composite (char+bg jako obraz startowy)
 *   5. Action (kinematyka z opisu PL)  6. Preferencje stylu odcinka
 *
 * Styl projektu (style_tags) i anchor wstrzykuje wspólny enrichment workflowBuilder.js
 * (krok 4) — NIE tutaj, żeby nie dublować logiki w dwóch miejscach.
 *
 * @ID: assety wiązane po stabilnym ref_id (kompilator dokleja `@`), bez „pierwszej postaci z bazy".
 */
function compileScenePlan(userPrompt, scene, refs, visualProfile) {
  const kinematics = inferKinematicsFromPolish(userPrompt);
  const i2vProfile = visualProfile.i2v_profile || EPISODE_I2V_PROFILE;
  const params = resolveWanRenderParams({ i2vProfile, durationSec: scene.duration_sec });

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

  const negativeParts = [visualProfile.negative_prompt, BASE_NEGATIVE]
    .join(', ')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const negativePrompt = Array.from(new Set(negativeParts)).join(', ');

  const characterRefId = refs.characterAsset?.ref_id ? `@${refs.characterAsset.ref_id}` : null;
  const locationRefId = refs.locationAsset?.ref_id ? `@${refs.locationAsset.ref_id}` : null;

  return {
    scene_summary: scene.description_pl,
    render_strategy: 'native_i2v',
    cinematography: { camera_shot: 'medium shot', camera_motion: 'static', lighting: 'natural light' },
    kinematics,
    positive_prompt: positivePrompt,
    negative_prompt: negativePrompt,
    character_ref: refs.characterRef,
    background_ref: refs.backgroundRef,
    character_ref_id: characterRefId,
    location_ref_id: locationRefId,
    asset_refs: [characterRefId, locationRefId].filter(Boolean),
    i2v_profile: params.profile,
    wan_length: params.length,
    wan_denoise: params.denoise,
    duration_sec: params.length / WAN_FPS,
    location_name: refs.locationAsset?.name || null,
    character_description: refs.characterAsset?.canon_en || refs.characterAsset?.description_pl || null,
    background_description: refs.locationAsset?.canon_en || refs.locationAsset?.description_pl || null,
    action_description: `${kinematics.subject_state || 'standing'}, ${kinematics.primary_motion || 'still'} motion at ${kinematics.velocity || 'normal'} pace`,
    episode_preferences: visualProfile.preferences,
    _source: 'deterministic',
  };
}

/** Build GPU director plan for a single scene from accepted episode plan (deterministyczny, zero LLM). */
export function buildSceneDirectorPlan(plan, scene, visualProfile) {
  const refs = resolveSceneAssetRefs(scene);
  const userPrompt = buildSceneUserPrompt(plan, scene);
  return compileScenePlan(userPrompt, scene, refs, visualProfile);
}
