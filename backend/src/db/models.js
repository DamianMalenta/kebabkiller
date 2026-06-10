import { v4 as uuidv4 } from 'uuid';
import { getDb } from './init.js';

export function listCharacters() {
  return getDb().prepare('SELECT * FROM characters ORDER BY name').all();
}

export function getCharacter(id) {
  return getDb().prepare('SELECT * FROM characters WHERE id = ?').get(id) ?? null;
}

export function createCharacter({ name, description, referencePath, negativePrompt, identityBlockEn }) {
  const id = uuidv4();
  try {
    getDb().prepare(`
      INSERT INTO characters (id, name, description, reference_path, negative_prompt, identity_block_en)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      description ?? '',
      referencePath ?? null,
      negativePrompt ?? 'human arms, hands, fingers, humanoid torso, melting, morphing',
      identityBlockEn ?? null
    );
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      throw new Error(`Postać "${name}" już istnieje. Użyj „Edytuj” na karcie po prawej zamiast dodawać duplikat.`);
    }
    throw err;
  }
  return getCharacter(id);
}

export function updateCharacter(id, { name, description, referencePath, negativePrompt, identityBlockEn }) {
  getDb().prepare(`
    UPDATE characters
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        reference_path = COALESCE(?, reference_path),
        negative_prompt = COALESCE(?, negative_prompt),
        identity_block_en = COALESCE(?, identity_block_en),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? null,
    description ?? null,
    referencePath ?? null,
    negativePrompt ?? null,
    identityBlockEn !== undefined ? identityBlockEn : null,
    id,
  );
  return getCharacter(id);
}

export function deleteCharacter(id) {
  return getDb().prepare('DELETE FROM characters WHERE id = ?').run(id).changes > 0;
}

export function listBackgrounds() {
  return getDb().prepare('SELECT * FROM backgrounds ORDER BY name').all();
}

export function getBackground(id) {
  return getDb().prepare('SELECT * FROM backgrounds WHERE id = ?').get(id) ?? null;
}

export function createBackground({ name, description, referencePath, environmentBlockEn }) {
  const id = uuidv4();
  try {
    getDb().prepare(`
      INSERT INTO backgrounds (id, name, description, environment_block_en, reference_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description ?? '', environmentBlockEn ?? null, referencePath ?? null);
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      throw new Error(`Tło "${name}" już istnieje. Użyj „Edytuj” na karcie po prawej zamiast dodawać duplikat.`);
    }
    throw err;
  }
  return getBackground(id);
}

export function updateBackground(id, { name, description, referencePath, environmentBlockEn }) {
  getDb().prepare(`
    UPDATE backgrounds
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        environment_block_en = COALESCE(?, environment_block_en),
        reference_path = COALESCE(?, reference_path),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? null,
    description ?? null,
    environmentBlockEn !== undefined ? environmentBlockEn : null,
    referencePath ?? null,
    id,
  );
  return getBackground(id);
}

export function deleteBackground(id) {
  return getDb().prepare('DELETE FROM backgrounds WHERE id = ?').run(id).changes > 0;
}

export function listRules({ activeOnly = false } = {}) {
  const sql = activeOnly
    ? 'SELECT * FROM rules WHERE active = 1 ORDER BY priority DESC, title'
    : 'SELECT * FROM rules ORDER BY priority DESC, title';
  return getDb().prepare(sql).all();
}

export function getRule(id) {
  return getDb().prepare('SELECT * FROM rules WHERE id = ?').get(id) ?? null;
}

export function createRule({ category, title, content, priority, active }) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO rules (id, category, title, content, priority, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    category ?? 'global',
    title,
    content,
    priority ?? 0,
    active === false ? 0 : 1,
  );
  return getRule(id);
}

export function updateRule(id, { category, title, content, priority, active }) {
  getDb().prepare(`
    UPDATE rules
    SET category = COALESCE(?, category),
        title = COALESCE(?, title),
        content = COALESCE(?, content),
        priority = COALESCE(?, priority),
        active = COALESCE(?, active),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    category,
    title,
    content,
    priority,
    active === undefined ? null : (active ? 1 : 0),
    id,
  );
  return getRule(id);
}

export function deleteRule(id) {
  return getDb().prepare('DELETE FROM rules WHERE id = ?').run(id).changes > 0;
}

export function listVideoJobs(limit = 50) {
  return getDb().prepare(`
    SELECT j.*, c.name AS character_name, b.name AS background_name
    FROM video_jobs j
    LEFT JOIN characters c ON c.id = j.character_id
    LEFT JOIN backgrounds b ON b.id = j.background_id
    ORDER BY j.created_at DESC
    LIMIT ?
  `).all(limit);
}

export function listVideoJobsByStatuses(statuses) {
  if (!statuses?.length) return [];
  const placeholders = statuses.map(() => '?').join(', ');
  return getDb().prepare(`
    SELECT j.*, c.name AS character_name, b.name AS background_name
    FROM video_jobs j
    LEFT JOIN characters c ON c.id = j.character_id
    LEFT JOIN backgrounds b ON b.id = j.background_id
    WHERE j.status IN (${placeholders})
    ORDER BY j.created_at ASC
  `).all(...statuses);
}

export function getVideoJob(id) {
  return getDb().prepare(`
    SELECT j.*, c.name AS character_name, b.name AS background_name
    FROM video_jobs j
    LEFT JOIN characters c ON c.id = j.character_id
    LEFT JOIN backgrounds b ON b.id = j.background_id
    WHERE j.id = ?
  `).get(id) ?? null;
}

export function createVideoJob({
  userPrompt,
  characterId,
  backgroundId,
  projectId,
  episodeId,
  sceneIndex,
  directorJson,
  renderStrategy,
}) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO video_jobs (
      id, user_prompt, character_id, background_id, project_id, episode_id, scene_index,
      director_json, render_strategy, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    id,
    userPrompt,
    characterId ?? null,
    backgroundId ?? null,
    projectId ?? null,
    episodeId ?? null,
    sceneIndex ?? null,
    directorJson ? JSON.stringify(directorJson) : null,
    renderStrategy ?? 'native_i2v',
  );
  return getVideoJob(id);
}

export function updateVideoJob(id, fields) {
  const allowed = [
    'status', 'director_json', 'render_strategy', 'output_path', 'error_message',
    'progress', 'completed_at', 'status_message', 'project_id', 'episode_id',
    'scene_index', 'is_canon',
  ];
  const sets = [];
  const values = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push(key === 'director_json' && typeof fields[key] === 'object'
        ? JSON.stringify(fields[key])
        : fields[key]);
    }
  }
  if (sets.length === 0) return getVideoJob(id);

  sets.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE video_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getVideoJob(id);
}

export function getKnowledgeContext() {
  return {
    characters: listCharacters(),
    backgrounds: listBackgrounds(),
    rules: listRules({ activeOnly: true }),
  };
}

// --- Projects ---

export function listProjects() {
  return getDb().prepare('SELECT * FROM projects ORDER BY name').all();
}

export function getProject(id) {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) ?? null;
}

function serializeStyleBible(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export function createProject({
  name,
  description,
  styleBibleJson,
  defaultCharacterId,
  defaultBackgroundId,
}) {
  const trimmedName = name?.trim();
  if (!trimmedName) throw new Error('Nazwa projektu jest wymagana.');

  const id = uuidv4();
  try {
    getDb().prepare(`
      INSERT INTO projects (id, name, description, style_bible_json, default_character_id, default_background_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      trimmedName,
      description ?? '',
      serializeStyleBible(styleBibleJson),
      defaultCharacterId ?? null,
      defaultBackgroundId ?? null,
    );
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      throw new Error(`Projekt "${name}" już istnieje.`);
    }
    throw err;
  }
  return getProject(id);
}

export function updateProject(id, fields) {
  const allowed = {
    name: 'name',
    description: 'description',
    style_bible_json: 'styleBibleJson',
    series_memory: 'seriesMemory',
    default_character_id: 'defaultCharacterId',
    default_background_id: 'defaultBackgroundId',
  };
  const sets = [];
  const values = [];

  for (const [col, key] of Object.entries(allowed)) {
    if (fields[key] !== undefined) {
      sets.push(`${col} = ?`);
      let val = fields[key];
      if (key === 'styleBibleJson') {
        val = serializeStyleBible(val);
      }
      values.push(val);
    }
  }

  if (sets.length === 0) return getProject(id);
  if (fields.seriesMemory !== undefined) {
    sets.push("series_memory_updated_at = datetime('now')");
  }
  sets.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getProject(id);
}

export function deleteProject(id) {
  return getDb().prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
}

// --- Episodes ---

export function listEpisodes(projectId) {
  return getDb().prepare(`
    SELECT * FROM episodes WHERE project_id = ? ORDER BY episode_number
  `).all(projectId);
}

export function getEpisode(id) {
  return getDb().prepare('SELECT * FROM episodes WHERE id = ?').get(id) ?? null;
}

export function createEpisode({
  projectId,
  episodeNumber,
  title,
  synopsisPl,
  directorNotes,
  status,
}) {
  const num = Number(episodeNumber);
  if (!Number.isInteger(num) || num < 1) {
    throw new Error('Numer odcinka musi być liczbą całkowitą większą od 0.');
  }

  const id = uuidv4();
  try {
    getDb().prepare(`
      INSERT INTO episodes (id, project_id, episode_number, title, synopsis_pl, director_notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      num,
      title ?? '',
      synopsisPl ?? '',
      directorNotes ?? null,
      status ?? 'draft',
    );
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed')) {
      throw new Error(`Odcinek ${episodeNumber} już istnieje w tym projekcie.`);
    }
    throw err;
  }
  return getEpisode(id);
}

export function updateEpisode(id, fields) {
  const allowed = ['title', 'synopsis_pl', 'director_notes', 'status', 'episode_number'];
  const sets = [];
  const values = [];
  const map = {
    title: 'title',
    synopsis_pl: 'synopsisPl',
    director_notes: 'directorNotes',
    status: 'status',
    episode_number: 'episodeNumber',
  };

  for (const [col, key] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      sets.push(`${col} = ?`);
      values.push(fields[key]);
    }
  }

  if (sets.length === 0) return getEpisode(id);
  sets.push("updated_at = datetime('now')");
  values.push(id);
  getDb().prepare(`UPDATE episodes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  return getEpisode(id);
}

export function deleteEpisode(id) {
  return getDb().prepare('DELETE FROM episodes WHERE id = ?').run(id).changes > 0;
}

// --- Render summaries & series memory ---

export function getRenderSummaryByJobId(jobId) {
  return getDb().prepare('SELECT * FROM render_summaries WHERE job_id = ?').get(jobId) ?? null;
}

export function hasSeriesMemoryRevisionForJob(jobId) {
  const row = getDb().prepare(
    'SELECT 1 AS ok FROM series_memory_revisions WHERE trigger_job_id = ? LIMIT 1',
  ).get(jobId);
  return row != null;
}

export function countSeriesMemoryRevisionsForJob(jobId) {
  return getDb().prepare(
    'SELECT COUNT(*) AS c FROM series_memory_revisions WHERE trigger_job_id = ?',
  ).get(jobId).c;
}

const CANON_LOCK_STALE_MINUTES = Number(process.env.CANON_ACCEPTANCE_LOCK_STALE_MINUTES) || 5;

/**
 * Atomowa blokada akceptacji kanonu (świeżej i zombie-resume).
 * Przeterminowany lock (>5 min) może zostać przejęty po kill -9.
 */
export function tryAcquireCanonAcceptanceLock(jobId) {
  const result = getDb().prepare(`
    UPDATE video_jobs
    SET canon_acceptance_in_progress = 1,
        canon_acceptance_lock_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
      AND status = 'completed'
      AND (
        canon_acceptance_in_progress = 0
        OR canon_acceptance_lock_at IS NULL
        OR canon_acceptance_lock_at < datetime('now', ?)
      )
  `).run(jobId, `-${CANON_LOCK_STALE_MINUTES} minutes`);
  return result.changes === 1;
}

export function releaseCanonAcceptanceLock(jobId) {
  getDb().prepare(`
    UPDATE video_jobs
    SET canon_acceptance_in_progress = 0,
        canon_acceptance_lock_at = NULL,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(jobId);
}

/** Pełny sukces akceptacji kanonu: summary + rewizja pamięci dla tego joba. */
export function isCanonAcceptanceComplete(jobId) {
  return Boolean(getRenderSummaryByJobId(jobId))
    && hasSeriesMemoryRevisionForJob(jobId);
}

export function upsertRenderSummary({
  jobId,
  projectId,
  episodeId,
  sceneIndex,
  summaryJson,
}) {
  const existing = getRenderSummaryByJobId(jobId);
  const payload = JSON.stringify(summaryJson);

  if (existing) {
    getDb().prepare(`
      UPDATE render_summaries
      SET project_id = ?, episode_id = ?, scene_index = ?, summary_json = ?
      WHERE job_id = ?
    `).run(projectId, episodeId ?? null, sceneIndex ?? null, payload, jobId);
    return getRenderSummaryByJobId(jobId);
  }

  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO render_summaries (id, job_id, project_id, episode_id, scene_index, summary_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, jobId, projectId, episodeId ?? null, sceneIndex ?? null, payload);
  return getRenderSummaryByJobId(jobId);
}

export function listRenderSummariesForProject(projectId, { limit = 5 } = {}) {
  return getDb().prepare(`
    SELECT rs.*, j.is_canon, j.created_at AS job_created_at
    FROM render_summaries rs
    JOIN video_jobs j ON j.id = rs.job_id
    WHERE rs.project_id = ? AND j.is_canon = 1
    ORDER BY rs.created_at DESC
    LIMIT ?
  `).all(projectId, limit);
}

/**
 * Atomowo rezerwuje kanon dla joba. Zwraca true tylko dla pierwszego wywołania.
 */
export function tryClaimJobCanon(jobId) {
  const result = getDb().prepare(`
    UPDATE video_jobs
    SET is_canon = 1, updated_at = datetime('now')
    WHERE id = ? AND is_canon = 0 AND status = 'completed'
  `).run(jobId);
  return result.changes === 1;
}

export function releaseJobCanonClaim(jobId) {
  getDb().prepare(`
    UPDATE video_jobs
    SET is_canon = 0, updated_at = datetime('now')
    WHERE id = ? AND is_canon = 1
  `).run(jobId);
}

export function setJobCanon(jobId, { projectId, episodeId, sceneIndex }) {
  const db = getDb();
  db.prepare(`
    UPDATE video_jobs
    SET is_canon = 0
    WHERE project_id = ?
      AND is_canon = 1
      AND (? IS NULL OR episode_id = ?)
      AND (? IS NULL OR scene_index = ?)
      AND id != ?
  `).run(
    projectId,
    episodeId ?? null, episodeId ?? null,
    sceneIndex ?? null, sceneIndex ?? null,
    jobId,
  );

  db.prepare(`
    UPDATE video_jobs
    SET is_canon = 1, project_id = COALESCE(project_id, ?), updated_at = datetime('now')
    WHERE id = ?
  `).run(projectId, jobId);

  return getVideoJob(jobId);
}

export function updateProjectSeriesMemory(projectId, memoryText) {
  getDb().prepare(`
    UPDATE projects
    SET series_memory = ?,
        series_memory_updated_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(memoryText, projectId);
  return getProject(projectId);
}

export function archiveSeriesMemoryRevision({
  projectId,
  memoryText,
  triggerJobId,
  compactionSource,
}) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO series_memory_revisions (id, project_id, memory_text, trigger_job_id, compaction_source)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, projectId, memoryText, triggerJobId ?? null, compactionSource ?? null);
  return id;
}

/**
 * Atomowy commit pamięci serialowej: projects.series_memory + rewizja (wszystko albo nic).
 */
export function commitCanonSeriesMemory({
  projectId,
  memoryText,
  triggerJobId,
  compactionSource,
}) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      UPDATE projects
      SET series_memory = ?,
          series_memory_updated_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(memoryText, projectId);

    const revisionId = uuidv4();
    db.prepare(`
      INSERT INTO series_memory_revisions (id, project_id, memory_text, trigger_job_id, compaction_source)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      revisionId,
      projectId,
      memoryText,
      triggerJobId ?? null,
      compactionSource ?? null,
    );

    db.exec('COMMIT');
    return { revisionId, project: getProject(projectId) };
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  }
}

function parseStyleBible(project) {
  if (!project?.style_bible_json) return project?.description || '';
  try {
    const parsed = JSON.parse(project.style_bible_json);
    if (typeof parsed === 'string') return parsed;
    if (parsed?.text) return parsed.text;
    return JSON.stringify(parsed);
  } catch {
    return project.style_bible_json;
  }
}

/**
 * Compact context for LLM — never includes full director_json.
 */
export function getSeriesContextForLlm({ projectId, episodeId, maxSummaries = 5 } = {}) {
  if (!projectId && episodeId) {
    const ep = getEpisode(episodeId);
    projectId = ep?.project_id;
  }
  if (!projectId) {
    throw new Error('project_id or episode_id is required');
  }

  const project = getProject(projectId);
  if (!project) throw new Error('Project not found');

  const episode = episodeId ? getEpisode(episodeId) : null;
  const episodes = listEpisodes(projectId);
  const priorEpisodes = episode
    ? episodes.filter((e) => e.episode_number < episode.episode_number)
    : episodes;

  const recentSummaries = listRenderSummariesForProject(projectId, { limit: maxSummaries });

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      style_bible: parseStyleBible(project),
      series_memory: project.series_memory || '',
      series_memory_updated_at: project.series_memory_updated_at,
      default_character_id: project.default_character_id,
      default_background_id: project.default_background_id,
    },
    episode: episode
      ? {
          id: episode.id,
          episode_number: episode.episode_number,
          title: episode.title,
          synopsis_pl: episode.synopsis_pl,
          director_notes: episode.director_notes,
        }
      : null,
    prior_episodes: priorEpisodes.map((e) => ({
      episode_number: e.episode_number,
      title: e.title,
      synopsis_pl: e.synopsis_pl,
    })),
    recent_summaries: recentSummaries.map((row) => ({
      job_id: row.job_id,
      scene_index: row.scene_index,
      summary_json: JSON.parse(row.summary_json),
      created_at: row.created_at,
    })),
    knowledge: getKnowledgeContext(),
  };
}

export function getDirectorContextForEpisode(episodeId) {
  const episode = getEpisode(episodeId);
  if (!episode) throw new Error('Episode not found');
  return getSeriesContextForLlm({ projectId: episode.project_id, episodeId });
}
