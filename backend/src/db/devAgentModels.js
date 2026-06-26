import { v4 as uuidv4 } from 'uuid';
import { getDb } from './init.js';

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hydrateMessage(row) {
  if (!row) return null;
  return {
    ...row,
    tool_calls: parseJson(row.tool_calls_json, null),
  };
}

export function listDevMessages({ limit = 200 } = {}) {
  const rows = getDb()
    .prepare(
      'SELECT * FROM dev_agent_messages ORDER BY created_at ASC LIMIT ?',
    )
    .all(limit);
  return rows.map(hydrateMessage);
}

export function insertDevMessage({ role, content, toolCalls = null }) {
  const id = uuidv4();
  getDb()
    .prepare(
      `INSERT INTO dev_agent_messages (id, role, content, tool_calls_json)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      id,
      role,
      content ?? '',
      toolCalls ? JSON.stringify(toolCalls) : null,
    );
  return hydrateMessage(
    getDb()
      .prepare('SELECT * FROM dev_agent_messages WHERE id = ?')
      .get(id),
  );
}

export function clearDevHistory() {
  getDb().prepare('DELETE FROM dev_agent_messages').run();
  return { ok: true };
}
