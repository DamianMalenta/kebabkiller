import { describe, test, expect } from '@jest/globals';
import { validateTakeAgainstSnapshot } from '../db/snapshotModels.js';

/**
 * Kontrakt walidacji Take wobec niemutowalnego Snapshotu sceny.
 *
 * Regresja: pętla produkcyjna pobierała wcześniej snapshot po kluczu głównym
 * (getSceneSnapshot(startSnapshot.id)), więc `currentSnapshot` zawsze był tym
 * samym wierszem co Take — guardy supersesji/wersji nie mogły zadziałać.
 * Teraz pobieramy NAJNOWSZY snapshot sceny (getLatestSceneSnapshot), więc te
 * przypadki muszą realnie odrzucać Take.
 */
describe('validateTakeAgainstSnapshot', () => {
  test('scena bez snapshotu (np. scena 0) → ok', () => {
    expect(validateTakeAgainstSnapshot({ clipSnapshotId: null })).toEqual({ ok: true, reason: null });
  });

  test('najnowszy snapshot == snapshot Take → ok', () => {
    expect(validateTakeAgainstSnapshot({
      clipSnapshotId: 'snap-1',
      clipSnapshotVersion: 2,
      currentSnapshot: { id: 'snap-1', version: 2 },
      storageExists: true,
    })).toEqual({ ok: true, reason: null });
  });

  test('snapshot zniknął → snapshot_missing', () => {
    expect(validateTakeAgainstSnapshot({
      clipSnapshotId: 'snap-1',
      clipSnapshotVersion: 1,
      currentSnapshot: null,
      storageExists: false,
    })).toEqual({ ok: false, reason: 'snapshot_missing' });
  });

  test('wyparty nowszą wersją (inne id) → snapshot_superseded', () => {
    expect(validateTakeAgainstSnapshot({
      clipSnapshotId: 'snap-1',
      clipSnapshotVersion: 1,
      currentSnapshot: { id: 'snap-2', version: 2 },
      storageExists: true,
    })).toEqual({ ok: false, reason: 'snapshot_superseded' });
  });

  test('to samo id, inna wersja → version_mismatch', () => {
    expect(validateTakeAgainstSnapshot({
      clipSnapshotId: 'snap-1',
      clipSnapshotVersion: 1,
      currentSnapshot: { id: 'snap-1', version: 3 },
      storageExists: true,
    })).toEqual({ ok: false, reason: 'version_mismatch' });
  });

  test('snapshot w bazie, brak pliku na dysku → storage_missing', () => {
    expect(validateTakeAgainstSnapshot({
      clipSnapshotId: 'snap-1',
      clipSnapshotVersion: 1,
      currentSnapshot: { id: 'snap-1', version: 1 },
      storageExists: false,
    })).toEqual({ ok: false, reason: 'storage_missing' });
  });
});
