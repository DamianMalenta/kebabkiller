/**
 * Issue 2 — kruchość wyrównania indeksów we wznowieniu produkcji.
 * `resolveResumePoint` musi wyznaczać scenę startu po TOŻSAMOŚCI klipu (plan_scene_id),
 * a nie po pozycji w tablicy `clips`. Gdy dla którejś sceny klip nigdy nie powstał,
 * indeks w `clips` nie pokrywa się z indeksem w `plan.scenes`.
 */
import { describe, test, expect } from '@jest/globals';
import { resolveResumePoint } from '../video/productionQueue.js';

const plan = {
  scenes: [
    { id: 's0', sort_order: 0 },
    { id: 's1', sort_order: 1 },
    { id: 's2', sort_order: 2 },
    { id: 's3', sort_order: 3 },
  ],
};

describe('resolveResumePoint', () => {
  test('brak nieudanego klipu → startSceneIndex = -1', () => {
    const clips = [
      { clip_code: 'E_SC01', plan_scene_id: 's0', status: 'completed' },
      { clip_code: 'E_SC02', plan_scene_id: 's1', status: 'completed' },
    ];
    expect(resolveResumePoint(plan, clips)).toEqual({ failedClip: null, startSceneIndex: -1 });
  });

  test('wyrównane tablice → indeks sceny == indeks w clips', () => {
    const clips = [
      { clip_code: 'E_SC01', plan_scene_id: 's0', status: 'completed' },
      { clip_code: 'E_SC02', plan_scene_id: 's1', status: 'failed' },
      { clip_code: 'E_SC03', plan_scene_id: 's2', status: 'pending' },
    ];
    const { failedClip, startSceneIndex } = resolveResumePoint(plan, clips);
    expect(failedClip.clip_code).toBe('E_SC02');
    expect(startSceneIndex).toBe(1);
  });

  test('LUKA w clips (brak klipu wcześniejszej sceny) → start po tożsamości, nie po pozycji', () => {
    // Klip dla sceny s0 nigdy nie powstał. Tablica clips jest krótsza od plan.scenes,
    // więc pozycja nieudanego klipu (index 2) != indeks jego sceny w planie (index 3).
    const clips = [
      { clip_code: 'E_SC02', plan_scene_id: 's1', status: 'completed' },
      { clip_code: 'E_SC03', plan_scene_id: 's2', status: 'completed' },
      { clip_code: 'E_SC04', plan_scene_id: 's3', status: 'failed' },
    ];
    const { failedClip, startSceneIndex } = resolveResumePoint(plan, clips);
    expect(failedClip.clip_code).toBe('E_SC04');
    // Poprawnie: s3 (indeks 3). Stara logika (index w clips = 2) wskazałaby s2 — błędnie.
    expect(startSceneIndex).toBe(3);
    expect(plan.scenes[startSceneIndex].id).toBe('s3');
  });

  test('nieudany klip wskazuje scenę spoza planu → rzuca błąd', () => {
    const clips = [
      { clip_code: 'E_SC09', plan_scene_id: 'obca-scena', status: 'failed' },
    ];
    expect(() => resolveResumePoint(plan, clips)).toThrow(/spoza planu odcinka/);
  });
});
