import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestDatabase, destroyTestDatabase } from './helpers/testDatabase.js';
import { createEpisodePlan } from '../db/episodeModels.js';
import { createProductionRun } from '../db/productionModels.js';
import { recoverStuckProductionOnStartup } from '../video/productionRecovery.js';
import { getDb } from '../db/init.js';

let testDir;

beforeAll(() => {
  ({ dir: testDir } = createTestDatabase());
});

afterAll(() => {
  destroyTestDatabase(testDir);
});

describe('recoverStuckProductionOnStartup', () => {
  test('oznacza stare running jako failed', () => {
    const db = getDb();
    const plan = createEpisodePlan({ code: 'REC1', title: 'Recovery' });
    db.prepare(`
      UPDATE episode_plans SET status = 'w_produkcji', updated_at = datetime('now', '-2 hours') WHERE id = ?
    `).run(plan.id);

    const run = createProductionRun({
      episodePlanId: plan.id,
      exportDir: '/output/test',
      clipsTotal: 1,
    });
    db.prepare(`
      UPDATE production_runs SET status = 'running', updated_at = datetime('now', '-2 hours') WHERE id = ?
    `).run(run.id);

    const result = recoverStuckProductionOnStartup();
    expect(result.runsRecovered).toBeGreaterThanOrEqual(1);

    const updated = db.prepare('SELECT status FROM production_runs WHERE id = ?').get(run.id);
    expect(updated.status).toBe('failed');
  });
});
