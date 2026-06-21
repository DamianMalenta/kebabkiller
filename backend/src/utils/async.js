/**
 * Shared async helpers used across backend modules.
 */

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Emit progress to an optional callback. Supports both bare percent and {percent, message} shapes.
 */
export function emitProgress(onProgress, percent, message) {
  if (!onProgress) return;
  onProgress(message ? { percent, message } : percent);
}
