import { getDb } from '../db/init.js';

const STUCK_MINUTES = 30;

/**
 * Przy starcie serwera: oznacz zawieszone runy i plany w_produkcji jako failed / zaakceptowany.
 */
export function recoverStuckProductionOnStartup() {
  const db = getDb();
  const cutoff = `-${STUCK_MINUTES} minutes`;

  const stuckRuns = db.prepare(`
    SELECT pr.id, pr.episode_plan_id, ep.code
    FROM production_runs pr
    JOIN episode_plans ep ON ep.id = pr.episode_plan_id
    WHERE pr.status IN ('running', 'pending')
      AND datetime(pr.updated_at) < datetime('now', ?)
  `).all(cutoff);

  let runsRecovered = 0;
  for (const run of stuckRuns) {
    db.prepare(`
      UPDATE production_runs SET status = 'failed',
        error_message = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      'Produkcja przerwana po restarcie serwera. Użyj Resume w panelu produkcji.',
      run.id,
    );
    db.prepare(`
      UPDATE production_clips SET status = 'failed',
        error_message = 'Produkcja przerwana po restarcie serwera.'
      WHERE production_run_id = ? AND status IN ('pending', 'rendering')
    `).run(run.id);
    runsRecovered += 1;
  }

  const stuckPlans = db.prepare(`
    SELECT id, code FROM episode_plans
    WHERE status = 'w_produkcji'
      AND datetime(updated_at) < datetime('now', ?)
  `).all(cutoff);

  let plansRecovered = 0;
  for (const plan of stuckPlans) {
    const active = db.prepare(`
      SELECT id FROM production_runs
      WHERE episode_plan_id = ? AND status IN ('running', 'pending')
    `).get(plan.id);
    if (!active) {
      db.prepare(`
        UPDATE episode_plans SET status = 'zaakceptowany', updated_at = datetime('now') WHERE id = ?
      `).run(plan.id);
      plansRecovered += 1;
    }
  }

  return { runsRecovered, plansRecovered };
}
