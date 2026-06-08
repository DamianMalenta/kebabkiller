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

export function getVideoJob(id) {
  return getDb().prepare(`
    SELECT j.*, c.name AS character_name, b.name AS background_name
    FROM video_jobs j
    LEFT JOIN characters c ON c.id = j.character_id
    LEFT JOIN backgrounds b ON b.id = j.background_id
    WHERE j.id = ?
  `).get(id) ?? null;
}

export function createVideoJob({ userPrompt, characterId, backgroundId, directorJson, renderStrategy }) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO video_jobs (id, user_prompt, character_id, background_id, director_json, render_strategy, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    id,
    userPrompt,
    characterId ?? null,
    backgroundId ?? null,
    directorJson ? JSON.stringify(directorJson) : null,
    renderStrategy ?? 'native_i2v',
  );
  return getVideoJob(id);
}

export function updateVideoJob(id, fields) {
  const allowed = ['status', 'director_json', 'render_strategy', 'output_path', 'error_message', 'progress', 'completed_at', 'status_message'];
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
