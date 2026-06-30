const COST_ACK_KEY = 'kk_runcomfy_cost_ack';

export function getCostAcknowledged() {
  try {
    return sessionStorage.getItem(COST_ACK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setCostAcknowledged(value) {
  try {
    if (value) sessionStorage.setItem(COST_ACK_KEY, '1');
    else sessionStorage.removeItem(COST_ACK_KEY);
  } catch {
    /* ignore */
  }
}

export default function CostGuardBanner({
  sceneCount = 1,
  totalSec = 5,
  acknowledged,
  onAcknowledgeChange,
}) {
  return (
    <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-100">
      <p className="font-medium">Koszt RunComfy (szacunek)</p>
      <p className="mt-1 text-xs text-amber-200/80">
        {sceneCount} scen × ~{Math.round(totalSec)} s łącznie. Sprawdź saldo w panelu RunComfy przed produkcją.
        Błąd „Insufficient funds” oznacza brak środków na koncie.
      </p>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => {
            onAcknowledgeChange?.(e.target.checked);
            setCostAcknowledged(e.target.checked);
          }}
        />
        Rozumiem koszt i mam środki na RunComfy
      </label>
    </div>
  );
}
