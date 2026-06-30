import { getEpisodePlan } from '../db/episodeModels.js';
import { runAiAuditBatchForEpisodePlan } from '../db/darkroomModels.js';

const MOCK_AI_PROMPT =
  'Cinematic dark lighting, 8k resolution, remove human hand, realistic textures';

/**
 * Symulator audytu Vision AI — w przyszłości zastąpiony prawdziwym API chmurowym.
 */
export function runAuditForEpisodePlan(episodePlanId) {
  if (!episodePlanId) {
    throw new Error('episodePlanId jest wymagane.');
  }
  if (!getEpisodePlan(episodePlanId)) {
    throw new Error('Plan odcinka nie istnieje.');
  }

  return runAiAuditBatchForEpisodePlan(episodePlanId, MOCK_AI_PROMPT);
}
