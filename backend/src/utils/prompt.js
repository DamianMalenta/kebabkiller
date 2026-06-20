/**
 * Shared prompt-building helpers for video generation pipelines.
 */

/**
 * Merge and deduplicate comma-separated negative prompt strings.
 * Splits each input by comma, trims, removes blanks, and deduplicates.
 */
export function deduplicateNegativePrompt(...sources) {
  const parts = sources
    .join(', ')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join(', ');
}
