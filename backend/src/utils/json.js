/**
 * Strips markdown code fences and parses JSON from LLM text output.
 */
export function parseJsonFromText(text) {
  const trimmed = String(text || '').trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  return JSON.parse(trimmed);
}

/**
 * Wspólna funkcja parsowania JSON dla całego backendu.
 * Bezpiecznie parsuje JSON z fallbackiem w przypadku błędu.
 */
export function parseJsonField(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Konwertuje typy SQLite na typy JavaScript.
 * SQLite używa integer (0/1) dla boolean, ale JavaScript używa true/false.
 * Obsługuje również przypadki gdy wartość jest już booleanem (np. z ręcznych zapytań).
 */
export function hydrateRow(row) {
  if (!row) return row;
  const hydrated = { ...row };
  // Konwertuj pola boolean (integer 0/1 → boolean true/false)
  for (const key of Object.keys(hydrated)) {
    if (key.startsWith('is_') || key.startsWith('has_') || key.endsWith('_enabled') || key.endsWith('_confirmed')) {
      const value = hydrated[key];
      // SQLite zwraca integer (0/1), ale jeśli już jest boolean, zostaw
      if (typeof value === 'number') {
        hydrated[key] = Boolean(value);
      } else if (typeof value !== 'boolean') {
        // Jeśli nie jest ani number ani boolean, ustaw na false dla bezpieczeństwa
        hydrated[key] = false;
      }
    }
  }
  return hydrated;
}
