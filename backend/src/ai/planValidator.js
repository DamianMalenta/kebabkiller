/**
 * PlanValidator — twarda granica kodu między Scenarzystą a Reżyserem.
 *
 * To NIE jest AI. To deterministyczny zwornik: plan, który nie mieści się w
 * możliwościach silnika (limity klatek / czasu / braki assetów), nie ma prawa
 * przejść do toru produkcji. Frozen plan: po akceptacji sceny są niezmienne.
 *
 * Cała logika walidacji limitów żyje w episodeModels.validateEpisodePlan
 * (czyta wanConfig). Ten moduł jest cienkim, nazwanym wejściem do tej granicy,
 * żeby reszta systemu odwoływała się do jednego pojęcia "PlanValidator".
 */
import {
  validateEpisodePlan,
  assertPlanEditable,
  isPlanFrozen,
  FROZEN_PLAN_STATUSES,
} from '../db/episodeModels.js';

/** Zwraca pełny wynik walidacji planu (ok, errors, warnings, status). */
export function validatePlan(episodePlanId) {
  return validateEpisodePlan(episodePlanId);
}

/**
 * Rzuca błędem, gdy plan nie nadaje się do przekazania Reżyserowi.
 * Używać na granicy akceptacji / produkcji, gdy potrzebny twardy stop.
 */
export function assertPlanProducible(episodePlanId) {
  const result = validateEpisodePlan(episodePlanId);
  if (!result.ok) {
    throw new Error(`Plan poza możliwościami silnika: ${result.errors.join(' ')}`);
  }
  return result;
}

export { assertPlanEditable, isPlanFrozen, FROZEN_PLAN_STATUSES };
