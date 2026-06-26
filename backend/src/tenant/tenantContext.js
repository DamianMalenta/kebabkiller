/**
 * Kontekst najemcy (multi-tenant plumbing).
 *
 * Na teraz system jest single-tenant: stała `DEFAULT_TENANT_ID = 'default'`.
 * Cała reszta (storage path, repozytorium snapshotów, payload joba) jest już
 * jednak w pełni "tenant-aware", więc przejście na realny multi-tenant sprowadzi
 * się do podawania innego `tenant_id` przy dispatchu joba — bez zmian w logice.
 *
 * Wymóg infrastruktury: `tenant_id` to CZYSTE ASCII (tylko znaki 0x21–0x7E, bez
 * spacji, bez separatorów ścieżki), bo trafia bezpośrednio do ścieżki na dysku
 * (`storage/tenants/{tenant_id}/...`) oraz do kluczy. UTF-8 jest zarezerwowane dla
 * opisów/payloadów JSON, nigdy dla kluczy technicznych.
 *
 * "Context Injection w workerach": worker (dispatch → setImmediate) ustawia
 * tenant_id w AsyncLocalStorage na samym starcie wykonania joba przez
 * `runWithTenant(tenantId, fn)`. Kod wewnątrz odczytuje go przez
 * `getCurrentTenantId()` — nie ma globalnego lookupu ani domyślnego fallbacku
 * w warstwie repozytorium (tam tenant_id jest zawsze przekazywany jawnie).
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export const DEFAULT_TENANT_ID = 'default';

const tenantStorage = new AsyncLocalStorage();

/**
 * Czyste ASCII dozwolone w identyfikatorze najemcy: znaki drukowalne ASCII bez
 * spacji i bez znaków ścieżki (`/`, `\`, `.`), żeby `tenant_id` nie mógł uciec
 * z katalogu `storage/tenants/{tenant_id}/...`.
 */
const TENANT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Czy łańcuch jest czystym (drukowalnym) ASCII (0x20–0x7E)? */
export function isAscii(str) {
  return typeof str === 'string' && /^[\x20-\x7E]*$/.test(str);
}

/**
 * Waliduje `tenant_id` jako czyste ASCII zgodne z wymogiem infrastruktury.
 * Rzuca, gdy wartość jest pusta, nie-ASCII albo zawiera znaki ścieżki.
 * Zwraca zwalidowany `tenant_id`.
 */
export function assertTenantId(tenantId) {
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new Error('tenant_id jest wymagany (niepusty łańcuch ASCII).');
  }
  if (!isAscii(tenantId) || !TENANT_ID_PATTERN.test(tenantId)) {
    throw new Error(
      `tenant_id musi być czystym ASCII [A-Za-z0-9_-] (otrzymano: ${JSON.stringify(tenantId)}).`,
    );
  }
  return tenantId;
}

/**
 * Uruchamia `fn` w kontekście danego `tenant_id` (AsyncLocalStorage).
 * Wywoływane przez worker na starcie obsługi joba ("Context Injection").
 */
export function runWithTenant(tenantId, fn) {
  const validated = assertTenantId(tenantId);
  return tenantStorage.run({ tenantId: validated }, fn);
}

/**
 * Ustawia `tenant_id` w kontekście dla CAŁEJ pozostałej (i zagnieżdżonej) części
 * bieżącego łańcucha asynchronicznego — bez owijania w callback. Używane przez
 * worker na samym starcie obsługi joba ("Context Injection"), gdy nie chcemy
 * re-indentować całej funkcji do `runWithTenant`. Zwraca zwalidowany tenant_id.
 */
export function enterTenant(tenantId) {
  const validated = assertTenantId(tenantId);
  tenantStorage.enterWith({ tenantId: validated });
  return validated;
}

/**
 * Zwraca `tenant_id` z bieżącego kontekstu wykonania.
 * Rzuca, gdy wywołane poza `runWithTenant` — to celowe: brak cichego globalnego
 * fallbacku, każdy kod wymagający tenant_id musi działać w jego kontekście.
 */
export function getCurrentTenantId() {
  const store = tenantStorage.getStore();
  if (!store?.tenantId) {
    throw new Error('Brak kontekstu najemcy: kod musi działać wewnątrz runWithTenant(tenantId, fn).');
  }
  return store.tenantId;
}

/** Bieżący `tenant_id` lub null, bez rzucania (do logów / ścieżek opcjonalnych). */
export function getCurrentTenantIdOrNull() {
  return tenantStorage.getStore()?.tenantId ?? null;
}
