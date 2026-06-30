import { v4 as uuidv4 } from 'uuid';
import {
  buildProjectBrain,
  getDirectorProject,
  updateDirectorProject,
  setProjectWizardStep,
  setEpisodeWizardStep,
  linkEpisodeToProject,
  updateSceneOverrides,
  updateSceneStoryboardMock,
  setAssetImageMetadata,
  getWizardContext,
  createEpisodePlan,
  updateEpisodePlan,
  replacePlanScenes,
  acceptEpisodePlan,
  getEpisodePlan,
} from '../../db/directorDeskModels.js';
import {
  advanceWizardStep,
  getAllowedToolNames,
  getStepPrompt,
  resolveWizardMode,
  SERIES_STEPS,
  EPISODE_STEPS,
  FREE_STEP,
} from './wizardStateMachine.js';
import { buildEpisodeStoryboardMock, buildSceneStoryboardMock } from './storyboardMock.js';
import { previewWorkflowForScene } from './workflowBuilder.js';
import { buildSceneDirectorPlan, buildEpisodeVisualProfile } from '../productionDirector.js';
import { attachPlanSceneAssets } from '../../db/episodeModels.js';

export function getToolDefinitions(allowedNames) {
  const all = {
    getProjectBrain: {
      name: 'getProjectBrain',
      description: 'Read current project brain (canon, scenes, tags)',
      parameters: { type: 'object', properties: {} },
    },
    setProjectName: {
      name: 'setProjectName',
      description: 'Set series/project name and description',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name'],
      },
    },
    updateCanonStyle: {
      name: 'updateCanonStyle',
      description: 'Save visual style rules to canon',
      parameters: {
        type: 'object',
        properties: {
          style_text: { type: 'string' },
          style_tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['style_text'],
      },
    },
    linkCanonAsset: {
      name: 'linkCanonAsset',
      description: 'Link catalog asset to series canon',
      parameters: {
        type: 'object',
        properties: { asset_id: { type: 'string' } },
        required: ['asset_id'],
      },
    },
    confirmCanon: {
      name: 'confirmCanon',
      description: 'User confirmed canon is ready',
      parameters: { type: 'object', properties: {} },
    },
    addGeneratorTag: {
      name: 'addGeneratorTag',
      description: 'Add dynamic generator tag visible in sidebar',
      parameters: {
        type: 'object',
        properties: { tag: { type: 'string' } },
        required: ['tag'],
      },
    },
    removeGeneratorTag: {
      name: 'removeGeneratorTag',
      description: 'Remove generator tag',
      parameters: {
        type: 'object',
        properties: { tag: { type: 'string' } },
        required: ['tag'],
      },
    },
    advanceWizard: {
      name: 'advanceWizard',
      description: 'Move to next wizard step when conditions met',
      parameters: { type: 'object', properties: {} },
    },
    createEpisodePlan: {
      name: 'createEpisodePlan',
      description: 'Create new episode plan linked to project',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          title: { type: 'string' },
          logline: { type: 'string' },
        },
        required: ['code', 'title'],
      },
    },
    updateEpisodeLogline: {
      name: 'updateEpisodeLogline',
      description: 'Update episode logline',
      parameters: {
        type: 'object',
        properties: {
          logline: { type: 'string' },
          preferences: { type: 'string' },
        },
        required: ['logline'],
      },
    },
    upsertScene: {
      name: 'upsertScene',
      description: 'Add or update a storyboard scene',
      parameters: {
        type: 'object',
        properties: {
          scene_id: { type: 'string' },
          description_pl: { type: 'string' },
          duration_sec: { type: 'number' },
          sort_order: { type: 'number' },
          asset_id: { type: 'string' },
          asset_image_id: { type: 'string' },
          location_asset_id: { type: 'string' },
        },
        required: ['description_pl'],
      },
    },
    removeScene: {
      name: 'removeScene',
      description: 'Remove scene by id',
      parameters: {
        type: 'object',
        properties: { scene_id: { type: 'string' } },
        required: ['scene_id'],
      },
    },
    updateSceneOverrides: {
      name: 'updateSceneOverrides',
      description: 'Set dynamic AI overrides (camera, fps, mood)',
      parameters: {
        type: 'object',
        properties: {
          scene_id: { type: 'string' },
          overrides: { type: 'object' },
        },
        required: ['scene_id', 'overrides'],
      },
    },
    buildStoryboardMock: {
      name: 'buildStoryboardMock',
      description: 'Generate cheap visual storyboard from assets',
      parameters: { type: 'object', properties: {} },
    },
    previewWorkflow: {
      name: 'previewWorkflow',
      description: 'Preview dynamic GPU workflow JSON for a scene',
      parameters: {
        type: 'object',
        properties: { scene_id: { type: 'string' } },
      },
    },
    acceptEpisodePlan: {
      name: 'acceptEpisodePlan',
      description: 'Accept episode plan after storyboard review',
      parameters: {
        type: 'object',
        properties: {
          start_production: { type: 'boolean', description: 'If true, start GPU production after accept' },
        },
      },
    },
    proposeProjectChange: {
      name: 'proposeProjectChange',
      description: 'Propose a destructive change requiring user confirmation',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          action: { type: 'object' },
        },
        required: ['summary', 'action'],
      },
    },
    listScenes: {
      name: 'listScenes',
      description: 'List current episode scenes',
      parameters: { type: 'object', properties: {} },
    },
    setAssetMetadata: {
      name: 'setAssetMetadata',
      description: 'Store deterministic image metadata for an asset image',
      parameters: {
        type: 'object',
        properties: {
          image_id: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['image_id', 'description'],
      },
    },
    startEpisodeWizard: {
      name: 'startEpisodeWizard',
      description: 'Begin episode onboarding for project',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string' }, title: { type: 'string' } },
      },
    },
    requestAssetUpload: {
      name: 'requestAssetUpload',
      description: 'Ask user to upload missing asset via UI widget',
      parameters: {
        type: 'object',
        properties: {
          scene_id: { type: 'string' },
          asset_type: { type: 'string' },
          hint: { type: 'string' },
        },
      },
    },
    attachSceneAsset: {
      name: 'attachSceneAsset',
      description: 'Attach catalog asset to scene',
      parameters: {
        type: 'object',
        properties: {
          scene_id: { type: 'string' },
          asset_id: { type: 'string' },
          asset_image_id: { type: 'string' },
          location_asset_id: { type: 'string' },
        },
        required: ['scene_id'],
      },
    },
    produceEpisode: {
      name: 'produceEpisode',
      description: 'Queue GPU production (requires accepted plan)',
      parameters: { type: 'object', properties: {} },
    },
  };

  return allowedNames.map((name) => all[name]).filter(Boolean);
}

export async function executeTool(name, args, ctx) {
  const { projectId, episodePlanId } = ctx;
  const project = getDirectorProject(projectId);
  if (!project) throw new Error('Projekt nie istnieje.');

  const mode = resolveWizardMode({
    projectStep: project.wizard_step,
    episodeStep: ctx.episode?.wizard_step,
    episodePlanId,
  });

  const allowed = getAllowedToolNames(mode, ctx.activeStep);
  if (!allowed.includes(name)) {
    throw new Error(`Narzędzie "${name}" niedostępne w kroku ${ctx.activeStep}.`);
  }

  switch (name) {
    case 'getProjectBrain':
      return buildProjectBrain(projectId, { episodePlanId });

    case 'setProjectName': {
      updateDirectorProject(projectId, {
        name: args.name,
        description: args.description ?? project.description,
      });
      return { ok: true, name: args.name };
    }

    case 'updateCanonStyle': {
      const canon = { ...project.canon, style_text: args.style_text, style_tags: args.style_tags || [] };
      updateDirectorProject(projectId, { canon });
      return { ok: true, canon };
    }

    case 'linkCanonAsset': {
      const ids = new Set(project.canon?.asset_ids || []);
      ids.add(args.asset_id);
      updateDirectorProject(projectId, { canon: { ...project.canon, asset_ids: [...ids] } });
      return { ok: true, asset_ids: [...ids] };
    }

    case 'confirmCanon': {
      updateDirectorProject(projectId, {
        canon: { ...project.canon, confirmed: true },
        deskStatus: 'canon_ready',
      });
      return { ok: true };
    }

    case 'addGeneratorTag': {
      const tags = new Set(project.generator_tags || []);
      tags.add(args.tag);
      updateDirectorProject(projectId, { generatorTags: [...tags] });
      return { ok: true, tags: [...tags] };
    }

    case 'removeGeneratorTag': {
      const tags = (project.generator_tags || []).filter((t) => t !== args.tag);
      updateDirectorProject(projectId, { generatorTags: tags });
      return { ok: true, tags };
    }

    case 'advanceWizard': {
      const wizardCtx = getWizardContext(projectId, episodePlanId);
      const result = advanceWizardStep({ mode, currentStep: ctx.activeStep, context: wizardCtx });
      if (!result.ok) return result;
      if (mode === 'series') {
        setProjectWizardStep(projectId, result.step);
        if (result.step === SERIES_STEPS.COMPLETE) {
          updateDirectorProject(projectId, { deskStatus: 'active' });
        }
      } else if (mode === 'episode' && episodePlanId) {
        setEpisodeWizardStep(episodePlanId, result.step);
      }
      return { ...result, prompt: getStepPrompt(mode, result.step) };
    }

    case 'createEpisodePlan': {
      const plan = createEpisodePlan({
        code: args.code,
        title: args.title,
        logline: args.logline || '',
        targetDurationSec: args.target_duration_sec || 12,
      });
      linkEpisodeToProject(plan.id, projectId);
      setEpisodeWizardStep(plan.id, EPISODE_STEPS.LOGLINE);
      plan.project_id = projectId;
      return plan;
    }

    case 'startEpisodeWizard': {
      const code = args.code || `E${String(Date.now()).slice(-4)}`;
      const plan = createEpisodePlan({
        code,
        title: args.title || 'Nowy odcinek',
        logline: '',
        targetDurationSec: args.target_duration_sec || 12,
      });
      linkEpisodeToProject(plan.id, projectId);
      setEpisodeWizardStep(plan.id, EPISODE_STEPS.START);
      plan.project_id = projectId;
      return plan;
    }

    case 'updateEpisodeLogline': {
      if (!episodePlanId) throw new Error('Brak aktywnego planu odcinka.');
      return updateEpisodePlan(episodePlanId, {
        logline: args.logline,
        preferences: args.preferences,
      });
    }

    case 'listScenes': {
      const plan = episodePlanId ? getEpisodePlan(episodePlanId) : null;
      return plan?.scenes || [];
    }

    case 'upsertScene': {
      if (!episodePlanId) throw new Error('Brak aktywnego planu odcinka.');
      const plan = getEpisodePlan(episodePlanId);
      let scenes = [...(plan.scenes || [])];
      if (args.scene_id) {
        scenes = scenes.map((s) =>
          s.id === args.scene_id
            ? {
                ...s,
                description_pl: args.description_pl ?? s.description_pl,
                duration_sec: args.duration_sec ?? s.duration_sec,
                sort_order: args.sort_order ?? s.sort_order,
                asset_id: args.asset_id ?? s.asset_id,
                asset_image_id: args.asset_image_id ?? s.asset_image_id,
                location_asset_id: args.location_asset_id ?? s.location_asset_id,
              }
            : s,
        );
      } else {
        scenes.push({
          id: uuidv4(),
          description_pl: args.description_pl,
          duration_sec: args.duration_sec ?? 4,
          sort_order: args.sort_order ?? scenes.length,
          asset_id: args.asset_id ?? null,
          asset_image_id: args.asset_image_id ?? null,
          location_asset_id: args.location_asset_id ?? null,
        });
      }
      return replacePlanScenes(episodePlanId, scenes);
    }

    case 'removeScene': {
      if (!episodePlanId) throw new Error('Brak aktywnego planu odcinka.');
      const plan = getEpisodePlan(episodePlanId);
      const scenes = (plan.scenes || []).filter((s) => s.id !== args.scene_id);
      return replacePlanScenes(episodePlanId, scenes);
    }

    case 'updateSceneOverrides': {
      const row = updateSceneOverrides(args.scene_id, args.overrides);
      const mock = buildSceneStoryboardMock({ ...row, ai_overrides: args.overrides });
      updateSceneStoryboardMock(args.scene_id, mock);
      return { scene: row, mock };
    }

    case 'buildStoryboardMock': {
      if (!episodePlanId) throw new Error('Brak aktywnego planu odcinka.');
      const plan = getEpisodePlan(episodePlanId);
      for (const scene of plan.scenes) {
        const mock = buildSceneStoryboardMock(scene);
        updateSceneStoryboardMock(scene.id, mock);
      }
      return buildEpisodeStoryboardMock(plan);
    }

    case 'previewWorkflow': {
      if (!episodePlanId) throw new Error('Brak aktywnego planu odcinka.');
      const plan = getEpisodePlan(episodePlanId);
      const scene = args.scene_id
        ? plan.scenes.find((s) => s.id === args.scene_id)
        : plan.scenes[0];
      if (!scene) throw new Error('Brak scen do podglądu workflow.');
      const visualProfile = buildEpisodeVisualProfile(plan);
      const compiled = await buildSceneDirectorPlan(plan, scene, visualProfile);
      return previewWorkflowForScene({
        userPrompt: scene.description_pl,
        directorJson: compiled,
        project,
        scene: { ...scene, ai_overrides: JSON.parse(scene.ai_overrides_json || '{}') },
        generatorTags: project.generator_tags,
      });
    }

    case 'acceptEpisodePlan': {
      if (!episodePlanId) throw new Error('Brak aktywnego planu odcinka.');
      return acceptEpisodePlan(episodePlanId);
    }

    case 'proposeProjectChange':
      return {
        requires_confirmation: true,
        summary: args.summary,
        action: args.action,
      };

    case 'setAssetMetadata':
      return setAssetImageMetadata(args.image_id, {
        description: args.description,
        analyzed_at: new Date().toISOString(),
        source: 'deterministic',
      });

    case 'requestAssetUpload':
      return {
        widget: 'AssetUploadRequest',
        scene_id: args.scene_id,
        asset_type: args.asset_type || 'location',
        hint: args.hint || 'Wrzuć zdjęcie referencyjne.',
      };

    case 'attachSceneAsset': {
      if (!episodePlanId) throw new Error('Brak aktywnego planu odcinka.');
      return attachPlanSceneAssets(episodePlanId, args.scene_id, {
        assetId: args.asset_id,
        assetImageId: args.asset_image_id,
        locationAssetId: args.location_asset_id,
      });
    }

    case 'produceEpisode':
      if (!episodePlanId) throw new Error('Brak aktywnego planu odcinka.');
      const planToProduce = getEpisodePlan(episodePlanId);
      if (planToProduce.status !== 'zaakceptowany' && planToProduce.status !== 'gotowy') {
        throw new Error('Plan musi zostać zaakceptowany przed produkcją.');
      }
      return { 
        action_required: 'call_produce_api', 
        episode_plan_id: episodePlanId,
        message: 'Produkcja jest gotowa do uruchomienia. Kliknij przycisk, aby wysłać plan na karty graficzne (GPU).' 
      };

    default:
      throw new Error(`Nieznane narzędzie: ${name}`);
  }
}
