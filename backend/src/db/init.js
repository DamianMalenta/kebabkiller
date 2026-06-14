import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from './sqliteDriver.js';
import { v4 as uuidv4 } from 'uuid';
import { syncLegacyAssetsFromKnowledge } from './episodeModels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  throw new Error('Database not initialized. Call initDatabase() first.');
}

export function initDatabase(dbPath) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });

  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec('PRAGMA journal_mode = WAL');
  dbInstance.exec('PRAGMA foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const tableStatements = [];
  const indexStatements = [];
  for (const stmt of statements) {
    if (/^CREATE INDEX/i.test(stmt)) {
      indexStatements.push(stmt);
    } else {
      tableStatements.push(stmt);
    }
  }

  for (const stmt of tableStatements) {
    try {
      dbInstance.exec(stmt);
    } catch {
      // Tabela/kolumna już istnieje w starszej bazy
    }
  }

  // Auto-migration for MVP
  try {
    dbInstance.exec('ALTER TABLE characters ADD COLUMN identity_block_en TEXT');
  } catch {
    // Column likely exists
  }
  try {
    dbInstance.exec('ALTER TABLE backgrounds ADD COLUMN environment_block_en TEXT');
  } catch {
    // Column likely exists
  }
  try {
    dbInstance.exec('ALTER TABLE video_jobs ADD COLUMN status_message TEXT');
  } catch {
    // Column likely exists
  }

  const migrations = [
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      style_bible_json TEXT,
      series_memory TEXT,
      series_memory_updated_at TEXT,
      default_character_id TEXT,
      default_background_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (default_character_id) REFERENCES characters(id),
      FOREIGN KEY (default_background_id) REFERENCES backgrounds(id)
    )`,
    `CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      synopsis_pl TEXT NOT NULL DEFAULT '',
      director_notes TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, episode_number)
    )`,
    `CREATE TABLE IF NOT EXISTS render_summaries (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      episode_id TEXT,
      scene_index INTEGER,
      summary_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES video_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS series_memory_revisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      memory_text TEXT NOT NULL,
      trigger_job_id TEXT,
      compaction_source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (trigger_job_id) REFERENCES video_jobs(id) ON DELETE SET NULL
    )`,
    'ALTER TABLE video_jobs ADD COLUMN project_id TEXT REFERENCES projects(id)',
    'ALTER TABLE video_jobs ADD COLUMN episode_id TEXT REFERENCES episodes(id)',
    'ALTER TABLE video_jobs ADD COLUMN scene_index INTEGER',
    'ALTER TABLE video_jobs ADD COLUMN is_canon INTEGER NOT NULL DEFAULT 0',
    'CREATE INDEX IF NOT EXISTS idx_video_jobs_project ON video_jobs(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_video_jobs_episode ON video_jobs(episode_id)',
    'CREATE INDEX IF NOT EXISTS idx_video_jobs_canon ON video_jobs(is_canon)',
    'ALTER TABLE video_jobs ADD COLUMN canon_acceptance_in_progress INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE video_jobs ADD COLUMN canon_acceptance_lock_at TEXT',
    'CREATE INDEX IF NOT EXISTS idx_render_summaries_project ON render_summaries(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project_id)',
    'ALTER TABLE projects ADD COLUMN desk_status TEXT NOT NULL DEFAULT \'draft\'',
    'ALTER TABLE projects ADD COLUMN wizard_step TEXT NOT NULL DEFAULT \'series_start\'',
    'ALTER TABLE projects ADD COLUMN canon_json TEXT',
    'ALTER TABLE projects ADD COLUMN generator_tags_json TEXT',
    'ALTER TABLE episode_plans ADD COLUMN project_id TEXT REFERENCES projects(id)',
    'ALTER TABLE episode_plans ADD COLUMN wizard_step TEXT NOT NULL DEFAULT \'episode_start\'',
    'ALTER TABLE plan_scenes ADD COLUMN ai_overrides_json TEXT',
    'ALTER TABLE plan_scenes ADD COLUMN storyboard_mock_json TEXT',
    'ALTER TABLE asset_images ADD COLUMN ai_metadata_json TEXT',
    // Faza B (@ID compiler): stabilny, niemutowalny ref_id assetu. BEZ backfillu (czysta karta).
    'ALTER TABLE assets ADD COLUMN ref_id TEXT',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_ref_id ON assets(ref_id)',
    `CREATE TABLE IF NOT EXISTS director_chat_messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      episode_plan_id TEXT,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL DEFAULT '',
      intent TEXT,
      widgets_json TEXT,
      pending_action_json TEXT,
      is_committed INTEGER NOT NULL DEFAULT 1,
      undo_of_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (episode_plan_id) REFERENCES episode_plans(id) ON DELETE SET NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_director_chat_project ON director_chat_messages(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_director_chat_episode ON director_chat_messages(episode_plan_id)',
    `CREATE TABLE IF NOT EXISTS director_side_threads (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      episode_plan_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (episode_plan_id) REFERENCES episode_plans(id) ON DELETE SET NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_director_side_threads_project ON director_side_threads(project_id)',
    `CREATE TABLE IF NOT EXISTS director_side_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (thread_id) REFERENCES director_side_threads(id) ON DELETE CASCADE
    )`,
    'CREATE INDEX IF NOT EXISTS idx_director_side_messages_thread ON director_side_messages(thread_id)',
  ];

  for (const sql of migrations) {
    try {
      dbInstance.exec(sql);
    } catch {
      // Table/column/index likely exists
    }
  }

  for (const stmt of indexStatements) {
    try {
      dbInstance.exec(stmt);
    } catch {
      // Index likely exists or column not yet present on legacy DB
    }
  }

  purgeToxicRules(dbInstance);
  seedDefaults(dbInstance);

  try {
    syncLegacyAssetsFromKnowledge();
  } catch (err) {
    console.warn('[init] syncLegacyAssetsFromKnowledge:', err.message);
  }

  return dbInstance;
}

function purgeToxicRules(db) {
  db.prepare(`
    DELETE FROM rules
    WHERE category IN ('render', 'global')
      AND (
        title IN ('Format wideo', 'Negative prompt', 'Spójność tła')
        OR content LIKE '%9:16%'
        OR content LIKE '%negative prompt%'
        OR content LIKE '%compositing%'
      )
  `).run();
}

function seedDefaults(db) {
  const charCount = db.prepare('SELECT COUNT(*) AS c FROM characters').get().c;
  if (charCount === 0) {
    db.prepare(`
      INSERT INTO characters (id, name, description, negative_prompt, identity_block_en)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'Kebabkiller',
      'Stożkowaty kebab z dwoma małymi nóżkami. Tekstura zgrillowanego mięsa. Bez rąk, bez twarzy ludzkiej.',
      'human arms, hands, fingers, humanoid torso, face, melting, morphing, extra limbs',
      'Anthropomorphic cylindrical rolled dürüm wrap with tiny legs. Grilled tortilla texture. No human arms, no human face.'
    );
  }

  const bgCount = db.prepare('SELECT COUNT(*) AS c FROM backgrounds').get().c;
  if (bgCount === 0) {
    db.prepare(`
      INSERT INTO backgrounds (id, name, description, environment_block_en)
      VALUES (?, ?, ?, ?)
    `).run(
      uuidv4(),
      'Piec_Brick',
      'Klasyczny piec z cegły, ciepłe oświetlenie, blat roboczy.',
      'Classic brick oven kitchen, warm industrial lighting, stable work counter surface. Full-frame sharp environment.',
    );
  }

  const kinematicRuleCount = db.prepare(`
    SELECT COUNT(*) AS c FROM rules WHERE category = 'kinematic'
  `).get().c;
  if (kinematicRuleCount === 0) {
    const rules = [
      ['kinematic', 'Anatomia Kebabkillera', 'Kebabkiller has no human arms, hands, or face. It tips and falls as a single rigid body with no joint articulation.', 100],
      ['kinematic', 'Fizyka upadku', 'Falls are rigid-body tumbles. No bending at waist, no human collapse poses.', 90],
    ];
    const insert = db.prepare(`
      INSERT INTO rules (id, category, title, content, priority)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const [category, title, content, priority] of rules) {
      insert.run(uuidv4(), category, title, content, priority);
    }
  }
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
