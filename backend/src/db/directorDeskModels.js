import { v4 as uuidv4 } from 'uuid';
import { getDb } from './init.js';
import { getProject, updateProject } from './models.js';
import {
  getEpisodePlan,
  createEpisodePlan,
  updateEpisodePlan,
  replacePlanScenes,
  acceptEpisodePlan,
  listAssets,
  FROZEN_PLAN_STATUSES,
} from './episodeModels.js';
import { buildEpisodeStoryboardMock } from '../ai/directorDesk/storyboardMock.js';
import { SERIES_STEPS, EPISODE_STEPS } from '../ai/directorDesk/wizardStateMachine.js';
import { parseJsonField as parseJson, hydrateRow } from '../utils/json.js';

function hydrateProject(row) {
  if (!row) return null;
  return {
    ...row,
    canon: parseJson(row.canon_json, {}),
    generator_tags: parseJson(row.generator_tags_json, []),
  };
}

function hydrateChatMessage(row) {
  if (!row) return null;
  const hydrated = hydrateRow(row);
  return {
    ...hydrated,
    widgets: parseJson(row.widgets_json, []),
    pending_action: parseJson(row.pending_action_json, null),
  };
}

export function getDirectorProject(id) {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return hydrateProject(row);
}

export function updateDirectorProject(id, fields) {
  const sets = [];
  const values = [];

  const map = {
    desk_status: fields.deskStatus,
    wizard_step: fields.wizardStep,
    canon_json: fields.canon !== undefined ? JSON.stringify(fields.canon) : undefined,
    generator_tags_json: fields.generatorTags !== undefined ? JSON.stringify(fields.generatorTags) : undefined,
    name: fields.name,
    description: fields.description,
  };

  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      sets.push(`${col} = ?`);
      values.push(val);
    }
  }

  if (sets.length === 0) return getDirectorProject(id);
  sets.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getDirectorProject(id);
}

export function setProjectWizardStep(projectId, step) {
  return updateDirectorProject(projectId, { wizardStep: step });
}

export function setEpisodeWizardStep(episodePlanId, step) {
  getDb().prepare(`
    UPDATE episode_plans SET wizard_step = ?, updated_at = datetime('now') WHERE id = ?
  `).run(step, episodePlanId);
  return getEpisodePlan(episodePlanId);
}

export function linkEpisodeToProject(episodePlanId, projectId) {
  getDb().prepare(`
    UPDATE episode_plans SET project_id = ?, updated_at = datetime('now') WHERE id = ?
  `).run(projectId, episodePlanId);
  return getEpisodePlan(episodePlanId);
}

export function updateSceneOverrides(sceneId, overrides) {
  getDb().prepare(`
    UPDATE plan_scenes
    SET ai_overrides_json = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(overrides), sceneId);
  return getDb().prepare('SELECT * FROM plan_scenes WHERE id = ?').get(sceneId);
}

export function updateSceneStoryboardMock(sceneId, mock) {
  getDb().prepare(`
    UPDATE plan_scenes
    SET storyboard_mock_json = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(mock), sceneId);
}

export function setAssetImageMetadata(imageId, metadata) {
  getDb().prepare(`
    UPDATE asset_images SET ai_metadata_json = ? WHERE id = ?
  `).run(JSON.stringify(metadata), imageId);
  return getDb().prepare('SELECT * FROM asset_images WHERE id = ?').get(imageId);
}

export function listDirectorChat(projectId, { episodePlanId, limit = 100 } = {}) {
  const rows = episodePlanId
    ? getDb().prepare(`
        SELECT * FROM director_chat_messages
        WHERE project_id = ? AND (episode_plan_id = ? OR episode_plan_id IS NULL)
          AND is_committed = 1
        ORDER BY created_at ASC
        LIMIT ?
      `).all(projectId, episodePlanId, limit)
    : getDb().prepare(`
        SELECT * FROM director_chat_messages
        WHERE project_id = ? AND is_committed = 1
        ORDER BY created_at ASC
        LIMIT ?
      `).all(projectId, limit);
  return rows.map(hydrateChatMessage);
}

export function insertDirectorChatMessage({
  projectId,
  episodePlanId,
  role,
  content,
  intent,
  widgets,
  pendingAction,
  isCommitted = true,
  undoOfId,
}) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO director_chat_messages (
      id, project_id, episode_plan_id, role, content, intent,
      widgets_json, pending_action_json, is_committed, undo_of_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    projectId,
    episodePlanId ?? null,
    role,
    content ?? '',
    intent ?? null,
    widgets ? JSON.stringify(widgets) : null,
    pendingAction ? JSON.stringify(pendingAction) : null,
    isCommitted ? 1 : 0,
    undoOfId ?? null,
  );
  return hydrateChatMessage(getDb().prepare('SELECT * FROM director_chat_messages WHERE id = ?').get(id));
}

export function markChatMessageUndone(messageId) {
  getDb().prepare(`
    UPDATE director_chat_messages SET is_committed = 0 WHERE id = ?
  `).run(messageId);
}

export function createSideThread({ projectId, episodePlanId, title }) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO director_side_threads (id, project_id, episode_plan_id, title)
    VALUES (?, ?, ?, ?)
  `).run(id, projectId, episodePlanId ?? null, title || 'Pomoc');
  return getDb().prepare('SELECT * FROM director_side_threads WHERE id = ?').get(id);
}

export function closeSideThread(threadId) {
  getDb().prepare(`
    UPDATE director_side_threads
    SET status = 'closed', closed_at = datetime('now')
    WHERE id = ?
  `).run(threadId);
}

export function listSideThreads(projectId) {
  return getDb().prepare(`
    SELECT * FROM director_side_threads
    WHERE project_id = ? AND status = 'open'
    ORDER BY created_at DESC
  `).all(projectId);
}

export function insertSideMessage({ threadId, role, content }) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO director_side_messages (id, thread_id, role, content)
    VALUES (?, ?, ?, ?)
  `).run(id, threadId, role, content ?? '');
  return getDb().prepare('SELECT * FROM director_side_messages WHERE id = ?').get(id);
}

export function listSideMessages(threadId) {
  return getDb().prepare(`
    SELECT * FROM director_side_messages WHERE thread_id = ? ORDER BY created_at ASC
  `).all(threadId);
}

export function buildProjectBrain(projectId, { episodePlanId } = {}) {
  const project = getDirectorProject(projectId);
  if (!project) return null;

  const assets = listAssets();
  const canonAssets = assets.filter((a) => {
    const meta = project.canon?.asset_ids || [];
    return meta.includes(a.id);
  });

  let episode = null;
  let storyboard = null;
  if (episodePlanId) {
    episode = getEpisodePlan(episodePlanId);
    if (episode) {
      episode = {
        ...episode,
        scenes: episode.scenes.map((s) => ({
          ...s,
          ai_overrides: parseJson(s.ai_overrides_json, {}),
          storyboard_mock: parseJson(s.storyboard_mock_json, null),
        })),
      };
      storyboard = buildEpisodeStoryboardMock(episode);
    }
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      desk_status: project.desk_status,
      wizard_step: project.wizard_step,
      canon: project.canon,
      generator_tags: project.generator_tags,
    },
    episode: episode
      ? {
          id: episode.id,
          code: episode.code,
          title: episode.title,
          logline: episode.logline,
          wizard_step: episode.wizard_step,
          status: episode.status,
          scenes: episode.scenes,
        }
      : null,
    canon_gallery: canonAssets.map((a) => ({
      id: a.id,
      type: a.type,
      name: a.name,
      primary_image: a.images?.find((i) => i.is_primary) || a.images?.[0] || null,
      metadata: a.images?.map((i) => parseJson(i.ai_metadata_json, null)).filter(Boolean),
    })),
    storyboard,
  };
}

export function getWizardContext(projectId, episodePlanId) {
  const project = getDirectorProject(projectId);
  const episode = episodePlanId ? getEpisodePlan(episodePlanId) : null;
  const canonAssetIds = project?.canon?.asset_ids || [];

  return {
    projectName: project?.name,
    canonStyle: project?.canon?.style_text || project?.description,
    canonAssetCount: canonAssetIds.length,
    canonConfirmed: project?.canon?.confirmed === true,
    episodePlanId: episode?.id,
    logline: episode?.logline,
    sceneCount: episode?.scenes?.length ?? 0,
    assetsReady: episode && episode.scenes.length > 0
      ? episode.scenes.every((s) => s.description_pl?.trim() && (s.asset_id || s.asset_image_id))
      : false,
    storyboardApproved: episode?.status && FROZEN_PLAN_STATUSES.has(episode.status),
  };
}

export {
  getProject,
  updateProject,
  getEpisodePlan,
  createEpisodePlan,
  updateEpisodePlan,
  replacePlanScenes,
  acceptEpisodePlan,
  SERIES_STEPS,
  EPISODE_STEPS,
};
