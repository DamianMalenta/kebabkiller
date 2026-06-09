import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from './sqliteDriver.js';
import { v4 as uuidv4 } from 'uuid';

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
  dbInstance.exec(schema);

  // Auto-migration for MVP
  try {
    dbInstance.exec('ALTER TABLE characters ADD COLUMN identity_block_en TEXT');
  } catch (err) {
    // Column likely exists
  }
  try {
    dbInstance.exec('ALTER TABLE backgrounds ADD COLUMN environment_block_en TEXT');
  } catch (err) {
    // Column likely exists
  }
  try {
    dbInstance.exec('ALTER TABLE video_jobs ADD COLUMN status_message TEXT');
  } catch (err) {
    // Column likely exists
  }

  purgeToxicRules(dbInstance);
  seedDefaults(dbInstance);

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
